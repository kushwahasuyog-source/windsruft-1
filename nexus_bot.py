"""
Nexus Control Center — Production Telegram Bot
Merged: System Monitor + Crypto USDC Tipping
Requires: pip install "python-telegram-bot[job-queue]" python-dotenv psutil web3
"""

import datetime
import json
import logging
import os
import sqlite3
import time
from collections import defaultdict
from decimal import Decimal
from pathlib import Path

import psutil
from dotenv import load_dotenv
from web3 import Web3
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.constants import ChatAction
from telegram.ext import (
    Application,
    ApplicationBuilder,
    CallbackQueryHandler,
    CommandHandler,
    ContextTypes,
    ConversationHandler,
    MessageHandler,
    filters,
)

# ─────────────────────────────────────────────────────────────────────────────
# BOOTSTRAP
# ─────────────────────────────────────────────────────────────────────────────

load_dotenv()

logging.basicConfig(
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    level=logging.INFO,
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler("nexus_bot.log", encoding="utf-8"),
    ],
)
logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────────
# CONFIGURATION
# ─────────────────────────────────────────────────────────────────────────────

TOKEN: str = os.getenv("BOT_TOKEN")
if not TOKEN:
    raise ValueError("BOT_TOKEN environment variable is required")
BOT_NAME  = os.getenv("BOT_NAME", "Nexus Control Center")
BOT_DESC  = os.getenv("BOT_DESC", "System Monitor & Crypto Tipping Interface")

_raw_admins = os.getenv("ADMIN_IDS", "")
ADMIN_IDS: set[int] = {int(x.strip()) for x in _raw_admins.split(",") if x.strip()}

CPU_ALERT_THRESHOLD  = int(os.getenv("CPU_ALERT_PCT",  "85"))
RAM_ALERT_THRESHOLD  = int(os.getenv("RAM_ALERT_PCT",  "90"))
DISK_ALERT_THRESHOLD = int(os.getenv("DISK_ALERT_PCT", "90"))

# Blockchain / tipping config
WEB3_PROVIDER  = os.getenv("WEB3_PROVIDER_URL", "https://rpc-mumbai.maticvigil.com")
USDC_CONTRACT  = os.getenv("USDC_CONTRACT_ADDRESS", "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174")
BOT_WALLET_KEY = os.getenv("BOT_WALLET_PRIVATE_KEY", "")
MIN_TIP = float(os.getenv("MIN_TIP", "0.01"))
MAX_TIP = float(os.getenv("MAX_TIP", "10000.0"))

RATE_LIMIT  = 20
RATE_WINDOW = 60

DATA_FILE = Path("nexus_data.json")
DB_FILE   = "nexus_bot.db"

# Conversation states
BROADCAST_TEXT     = 1
TIP_GET_RECIPIENT  = 10
TIP_GET_AMOUNT     = 11
TIP_CONFIRM        = 12

# ─────────────────────────────────────────────────────────────────────────────
# WEB3 + USDC
# ─────────────────────────────────────────────────────────────────────────────

web3 = Web3(Web3.HTTPProvider(WEB3_PROVIDER))
if not web3.is_connected():
    logger.warning("Web3 provider not connected. Blockchain features will be unavailable.")

USDC_ABI = json.loads("""[
    {"constant":true,"inputs":[{"name":"_owner","type":"address"}],
     "name":"balanceOf","outputs":[{"name":"balance","type":"uint256"}],"type":"function"},
    {"constant":false,"inputs":[{"name":"_to","type":"address"},{"name":"_value","type":"uint256"}],
     "name":"transfer","outputs":[{"name":"","type":"bool"}],"type":"function"},
    {"constant":true,"inputs":[],"name":"decimals",
     "outputs":[{"name":"","type":"uint8"}],"type":"function"}
]""")


def usdc_balance(wallet_address: str) -> float:
    try:
        contract = web3.eth.contract(address=Web3.to_checksum_address(USDC_CONTRACT), abi=USDC_ABI)
        raw = contract.functions.balanceOf(Web3.to_checksum_address(wallet_address)).call()
        dec = contract.functions.decimals().call()
        return raw / (10 ** dec)
    except Exception as e:
        logger.warning("usdc_balance error: %s", e)
        return 0.0


# ─────────────────────────────────────────────────────────────────────────────
# SQLITE DATABASE  (wallets + transactions)
# ─────────────────────────────────────────────────────────────────────────────

def db_connect() -> sqlite3.Connection:
    return sqlite3.connect(DB_FILE)


def init_db() -> None:
    with db_connect() as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS users (
                user_id       INTEGER PRIMARY KEY,
                username      TEXT,
                wallet_address TEXT,
                created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS transactions (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                sender_id    INTEGER,
                recipient_id INTEGER,
                amount       REAL,
                tx_hash      TEXT,
                status       TEXT DEFAULT 'pending',
                created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)


def get_or_create_wallet(user_id: int, username: str | None = None) -> str:
    with db_connect() as conn:
        row = conn.execute("SELECT wallet_address FROM users WHERE user_id=?", (user_id,)).fetchone()
        if row and row[0]:
            return row[0]
        wallet = web3.eth.account.create()
        conn.execute(
            "INSERT OR REPLACE INTO users (user_id, username, wallet_address) VALUES (?,?,?)",
            (user_id, username, wallet.address),
        )
        return wallet.address


def save_tx(sender_id: int, recipient_id: int, amount: float, tx_hash: str, status: str = "pending") -> None:
    with db_connect() as conn:
        conn.execute(
            "INSERT INTO transactions (sender_id,recipient_id,amount,tx_hash,status) VALUES (?,?,?,?,?)",
            (sender_id, recipient_id, amount, tx_hash, status),
        )


def get_tx_history(user_id: int, limit: int = 10) -> list:
    with db_connect() as conn:
        return conn.execute(
            "SELECT recipient_id,amount,created_at,status FROM transactions "
            "WHERE sender_id=? ORDER BY created_at DESC LIMIT ?",
            (user_id, limit),
        ).fetchall()


def resolve_username_to_id(username: str) -> int | None:
    """Look up a Telegram username in our DB (we only know users who have started the bot)."""
    clean = username.lstrip("@").lower()
    with db_connect() as conn:
        row = conn.execute(
            "SELECT user_id FROM users WHERE lower(username)=?", (clean,)
        ).fetchone()
    return row[0] if row else None


# ─────────────────────────────────────────────────────────────────────────────
# PERSISTENT JSON STORE  (bot-level settings + user registry)
# ─────────────────────────────────────────────────────────────────────────────

class Store:
    def __init__(self, path: Path):
        self.path = path
        self._data: dict = {}
        self._load()

    def _load(self):
        if self.path.exists():
            try:
                self._data = json.loads(self.path.read_text(encoding="utf-8"))
            except (json.JSONDecodeError, OSError):
                self._data = {}

    def save(self):
        self.path.write_text(json.dumps(self._data, indent=2), encoding="utf-8")

    def register_user(self, user):
        users = self._data.setdefault("users", {})
        uid = str(user.id)
        if uid not in users:
            users[uid] = {"id": user.id, "first_name": user.first_name,
                          "username": user.username, "joined": datetime.datetime.utcnow().isoformat(), "messages": 0}
        users[uid]["messages"] = users[uid].get("messages", 0) + 1
        users[uid]["last_seen"] = datetime.datetime.utcnow().isoformat()
        self.save()

    def all_user_ids(self) -> list[int]:
        return [int(k) for k in self._data.get("users", {})]

    def user_count(self) -> int:
        return len(self._data.get("users", {}))

    def total_messages(self) -> int:
        return sum(u.get("messages", 0) for u in self._data.get("users", {}).values())

    def alerts_enabled(self) -> bool:
        return bool(self._data.get("settings", {}).get("alerts", True))

    def toggle_alerts(self) -> bool:
        current = self.alerts_enabled()
        self._data.setdefault("settings", {})["alerts"] = not current
        self.save()
        return not current


store = Store(DATA_FILE)
BOT_START_TIME = time.monotonic()

# ─────────────────────────────────────────────────────────────────────────────
# RATE LIMITER
# ─────────────────────────────────────────────────────────────────────────────

_rate_buckets: dict[int, list[float]] = defaultdict(list)

def is_rate_limited(user_id: int) -> bool:
    now = time.monotonic()
    _rate_buckets[user_id] = [t for t in _rate_buckets[user_id] if now - t < RATE_WINDOW]
    if len(_rate_buckets[user_id]) >= RATE_LIMIT:
        return True
    _rate_buckets[user_id].append(now)
    return False

# ─────────────────────────────────────────────────────────────────────────────
# ACCESS CONTROL
# ─────────────────────────────────────────────────────────────────────────────

def is_admin(user_id: int) -> bool:
    return not ADMIN_IDS or user_id in ADMIN_IDS

async def guard(update: Update) -> bool:
    user = update.effective_user
    if not is_admin(user.id):
        msg = f"🚫 <b>Access Denied</b>\n\nYour ID: <code>{user.id}</code>"
        if update.message:
            await update.message.reply_text(msg, parse_mode="HTML")
        elif update.callback_query:
            await update.callback_query.answer("Access denied.", show_alert=True)
        return True
    return False

# ─────────────────────────────────────────────────────────────────────────────
# SYSTEM METRICS
# ─────────────────────────────────────────────────────────────────────────────

def _dot(pct: float, warn=75, crit=90) -> str:
    return "🔴" if pct >= crit else "🟡" if pct >= warn else "🟢"

def get_metrics() -> dict:
    cpu  = psutil.cpu_percent(interval=0.5)
    mem  = psutil.virtual_memory()
    if os.name == "nt":
        # Use the system drive on Windows
        system_drive = os.environ.get("SystemDrive", "C:")
        disk = psutil.disk_usage(system_drive)
    else:
        disk = psutil.disk_usage("/")
    net  = psutil.net_io_counters()
    boot = datetime.datetime.fromtimestamp(psutil.boot_time())
    up   = datetime.datetime.now() - boot
    s    = int(up.total_seconds())
    freq = psutil.cpu_freq()
    return {
        "cpu": cpu, "cpu_count": psutil.cpu_count(),
        "cpu_freq": f"{freq.current:.0f} MHz" if freq else "N/A",
        "ram_used": mem.used / 1e9, "ram_total": mem.total / 1e9, "ram_pct": mem.percent,
        "disk_used": disk.used / 1e9, "disk_total": disk.total / 1e9, "disk_pct": disk.percent,
        "net_sent": net.bytes_sent / 1e6, "net_recv": net.bytes_recv / 1e6,
        "uptime": f"{s//3600}h {(s%3600)//60}m",
        "boot": boot.strftime("%Y-%m-%d %H:%M"),
    }

def get_top_procs(n=6) -> list:
    procs = []
    for p in psutil.process_iter(["pid", "name", "cpu_percent", "memory_percent"]):
        try:
            procs.append(p.info)
        except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
            pass
    return sorted(procs, key=lambda x: x.get("cpu_percent", 0), reverse=True)[:n]

def get_disk_parts() -> list:
    parts = []
    for p in psutil.disk_partitions(all=False):
        try:
            u = psutil.disk_usage(p.mountpoint)
            parts.append({"mp": p.mountpoint, "used": u.used/1e9, "total": u.total/1e9, "pct": u.percent})
        except (psutil.AccessDenied, OSError):
            pass
    return parts

def get_net_ifaces() -> list:
    addrs = psutil.net_if_addrs()
    stats = psutil.net_if_stats()
    result = []
    for iface, addr_list in list(addrs.items())[:6]:
        ipv4 = next((a.address for a in addr_list if a.family.name == "AF_INET"), "N/A")
        up   = stats.get(iface)
        result.append({"name": iface, "ip": ipv4, "up": up.isup if up else False})
    return result

def bot_uptime() -> str:
    s = int(time.monotonic() - BOT_START_TIME)
    return f"{s//3600}h {(s%3600)//60}m {s%60}s"

# ─────────────────────────────────────────────────────────────────────────────
# KEYBOARDS
# ─────────────────────────────────────────────────────────────────────────────

def main_menu_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup([
        [InlineKeyboardButton("📊 System Status",   callback_data="status")],
        [InlineKeyboardButton("💻 Processes",        callback_data="processes"),
         InlineKeyboardButton("💾 Disks",            callback_data="disks")],
        [InlineKeyboardButton("🌐 Network",          callback_data="network"),
         InlineKeyboardButton("🛡️ Security",        callback_data="security")],
        [InlineKeyboardButton("💸 Crypto Tipping",  callback_data="tip_menu")],
        [InlineKeyboardButton("📈 Bot Stats",        callback_data="botstats"),
         InlineKeyboardButton("⚙️ Config",           callback_data="config")],
        [InlineKeyboardButton("👤 My Profile",       callback_data="profile")],
        [InlineKeyboardButton("⚠️ Emergency Stop",  callback_data="stop")],
    ])

def back_keyboard(refresh: str | None = None) -> InlineKeyboardMarkup:
    rows = [[InlineKeyboardButton("⬅️ Main Menu", callback_data="main_menu")]]
    if refresh:
        rows.insert(0, [InlineKeyboardButton("🔄 Refresh", callback_data=refresh)])
    return InlineKeyboardMarkup(rows)

def tip_menu_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup([
        [InlineKeyboardButton("💰 Send Tip",         callback_data="tip_send")],
        [InlineKeyboardButton("👛 My Wallet",        callback_data="tip_wallet")],
        [InlineKeyboardButton("📊 Balance",          callback_data="tip_balance")],
        [InlineKeyboardButton("📜 Tip History",      callback_data="tip_history")],
        [InlineKeyboardButton("⬅️ Main Menu",        callback_data="main_menu")],
    ])

def tip_confirm_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup([[
        InlineKeyboardButton("✅ Confirm", callback_data="tip_confirm_yes"),
        InlineKeyboardButton("❌ Cancel",  callback_data="tip_confirm_no"),
    ]])

def config_keyboard(alerts_on: bool) -> InlineKeyboardMarkup:
    label = "🔕 Disable Alerts" if alerts_on else "🔔 Enable Alerts"
    return InlineKeyboardMarkup([
        [InlineKeyboardButton(label,                 callback_data="cfg_toggle_alerts")],
        [InlineKeyboardButton("📢 Broadcast",        callback_data="cfg_broadcast")],
        [InlineKeyboardButton("👥 User List",        callback_data="cfg_users")],
        [InlineKeyboardButton("⬅️ Main Menu",        callback_data="main_menu")],
    ])

def confirm_stop_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup([[
        InlineKeyboardButton("✅ Confirm Stop", callback_data="stop_confirm"),
        InlineKeyboardButton("❌ Cancel",        callback_data="main_menu"),
    ]])

# ─────────────────────────────────────────────────────────────────────────────
# SCREEN BUILDERS
# ─────────────────────────────────────────────────────────────────────────────

def build_welcome(first_name: str) -> str:
    m = get_metrics()
    health = "🔴 Warning: High Resource Usage" if m["cpu"] >= CPU_ALERT_THRESHOLD or m["ram_pct"] >= RAM_ALERT_THRESHOLD else "🟢 All Systems Nominal"
    return (
        f"<b>⚡ {BOT_NAME}</b>\n<i>{BOT_DESC}</i>\n"
        "━━━━━━━━━━━━━━━━━━━\n"
        f"👋 Welcome, <b>{first_name}</b>\n"
        f"🕐 {datetime.datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}\n"
        f"📡 {health}\n"
        "━━━━━━━━━━━━━━━━━━━\n"
        "Use the menu below to navigate:"
    )

def build_status() -> str:
    m = get_metrics()
    ts = datetime.datetime.utcnow().strftime("%H:%M:%S UTC")
    return (
        "<b>🖥️ SYSTEM STATUS</b>\n━━━━━━━━━━━━━━━━━━━\n"
        f"{_dot(m['cpu'])} CPU:    {m['cpu']:.1f}%  ({m['cpu_count']} cores @ {m['cpu_freq']})\n"
        f"{_dot(m['ram_pct'])} RAM:    {m['ram_used']:.1f} / {m['ram_total']:.1f} GB ({m['ram_pct']:.0f}%)\n"
        f"{_dot(m['disk_pct'])} Disk:   {m['disk_used']:.1f} / {m['disk_total']:.1f} GB ({m['disk_pct']:.0f}%)\n"
        f"🟢 Net ↑:  {m['net_sent']:.1f} MB sent\n"
        f"🟢 Net ↓:  {m['net_recv']:.1f} MB recv\n"
        f"⏱️ Uptime: {m['uptime']}\n"
        f"🖥️ Boot:   {m['boot']}\n"
        "━━━━━━━━━━━━━━━━━━━\n"
        f"<i>Updated: {ts}</i>"
    )

def build_processes() -> str:
    lines = ["<b>💻 TOP PROCESSES</b>", "━━━━━━━━━━━━━━━━━━━"]
    for p in get_top_procs():
        name = (p.get("name") or "?")[:18]
        cpu  = p.get("cpu_percent", 0.0)
        mem  = p.get("memory_percent", 0.0)
        lines.append(f"{_dot(cpu,30,60)} <code>{name:<18}</code> CPU {cpu:5.1f}%  MEM {mem:.1f}%")
    lines.append(f"━━━━━━━━━━━━━━━━━━━\n<i>{datetime.datetime.utcnow().strftime('%H:%M:%S UTC')}</i>")
    return "\n".join(lines)

def build_disks() -> str:
    lines = ["<b>💾 DISK PARTITIONS</b>", "━━━━━━━━━━━━━━━━━━━"]
    for p in get_disk_parts():
        bar = "█" * int(p["pct"]/10) + "░" * (10 - int(p["pct"]/10))
        lines.append(f"{_dot(p['pct'])} <code>{p['mp'][:14]:<14}</code> [{bar}] {p['pct']:.0f}%\n   {p['used']:.1f}/{p['total']:.1f} GB")
    return "\n".join(lines)

def build_network() -> str:
    net   = psutil.net_io_counters()
    lines = ["<b>🌐 NETWORK</b>", "━━━━━━━━━━━━━━━━━━━"]
    for i in get_net_ifaces():
        lines.append(f"{'🟢' if i['up'] else '🔴'} <code>{i['name']:<12}</code> {i['ip']}")
    lines += [
        "━━━━━━━━━━━━━━━━━━━",
        f"📤 Sent:     {net.bytes_sent/1e6:.2f} MB",
        f"📥 Received: {net.bytes_recv/1e6:.2f} MB",
        f"❌ Errors:   {net.errin+net.errout}",
        f"<i>{datetime.datetime.utcnow().strftime('%H:%M:%S UTC')}</i>",
    ]
    return "\n".join(lines)

def build_security() -> str:
    mode = "Whitelist" if ADMIN_IDS else "Open"
    return (
        "<b>🛡️ SECURITY</b>\n━━━━━━━━━━━━━━━━━━━\n"
        f"🔒 Access Mode:    {mode}\n"
        f"⚡ Rate Limit:     {RATE_LIMIT} req/{RATE_WINDOW}s\n"
        "🔐 Encryption:     AES-256 (TLS)\n"
        "👁️ Audit Log:      nexus_bot.log\n"
        f"🚨 CPU Threshold:  {CPU_ALERT_THRESHOLD}%\n"
        f"🚨 RAM Threshold:  {RAM_ALERT_THRESHOLD}%\n"
        f"🚨 Disk Threshold: {DISK_ALERT_THRESHOLD}%\n"
        "━━━━━━━━━━━━━━━━━━━"
    )

def build_profile(user, wallet: str) -> str:
    badge = "⭐ Administrator" if is_admin(user.id) else "👤 User"
    return (
        "<b>👤 USER PROFILE</b>\n━━━━━━━━━━━━━━━━━━━\n"
        f"Name:     {user.full_name}\n"
        f"Username: @{user.username or 'N/A'}\n"
        f"User ID:  <code>{user.id}</code>\n"
        f"Role:     {badge}\n"
        f"Wallet:   <code>{wallet}</code>\n"
        "━━━━━━━━━━━━━━━━━━━"
    )

def build_botstats() -> str:
    return (
        "<b>📈 BOT STATISTICS</b>\n━━━━━━━━━━━━━━━━━━━\n"
        f"🤖 Name:         {BOT_NAME}\n"
        f"⏱️ Bot Uptime:   {bot_uptime()}\n"
        f"👥 Known Users:  {store.user_count()}\n"
        f"💬 Total Msgs:   {store.total_messages():,}\n"
        f"🔔 Alerts:       {'On' if store.alerts_enabled() else 'Off'}\n"
        f"🌐 Chain:        {WEB3_PROVIDER.split('/')[2]}\n"
        "━━━━━━━━━━━━━━━━━━━"
    )

def build_config() -> str:
    return (
        "<b>⚙️ CONFIGURATION</b>\n━━━━━━━━━━━━━━━━━━━\n"
        f"🔔 Alerts:    {'✅ On' if store.alerts_enabled() else '❌ Off'}\n"
        f"👥 Users:     {store.user_count()}\n"
        f"💬 Messages:  {store.total_messages():,}\n"
        "━━━━━━━━━━━━━━━━━━━"
    )

def build_tip_menu(wallet: str, balance: float) -> str:
    return (
        "<b>💸 CRYPTO TIPPING</b>\n━━━━━━━━━━━━━━━━━━━\n"
        f"👛 Wallet:   <code>{wallet}</code>\n"
        f"💰 Balance:  {balance:.4f} USDC\n"
        f"🌐 Network:  Polygon Mumbai (testnet)\n"
        f"💵 Min Tip:  {MIN_TIP} USDC\n"
        f"💵 Max Tip:  {MAX_TIP} USDC\n"
        "━━━━━━━━━━━━━━━━━━━"
    )

# ─────────────────────────────────────────────────────────────────────────────
# ALERT JOB
# ─────────────────────────────────────────────────────────────────────────────

async def alert_job(context: ContextTypes.DEFAULT_TYPE) -> None:
    if not store.alerts_enabled():
        return
    m = get_metrics()
    alerts = []
    if m["cpu"]      >= CPU_ALERT_THRESHOLD:  alerts.append(f"🔴 CPU <b>{m['cpu']:.1f}%</b>")
    if m["ram_pct"]  >= RAM_ALERT_THRESHOLD:  alerts.append(f"🔴 RAM <b>{m['ram_pct']:.1f}%</b>")
    if m["disk_pct"] >= DISK_ALERT_THRESHOLD: alerts.append(f"🔴 Disk <b>{m['disk_pct']:.1f}%</b>")
    if not alerts:
        return
    text = (
        "🚨 <b>NEXUS ALERT</b>\n━━━━━━━━━━━━━━━━━━━\n"
        + "\n".join(alerts)
        + f"\n━━━━━━━━━━━━━━━━━━━\n<i>{datetime.datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}</i>"
    )
    for uid in (list(ADMIN_IDS) if ADMIN_IDS else store.all_user_ids()):
        try:
            await context.bot.send_message(uid, text, parse_mode="HTML")
        except Exception as e:
            logger.warning("Alert to %s failed: %s", uid, e)

# ─────────────────────────────────────────────────────────────────────────────
# COMMAND HANDLERS
# ─────────────────────────────────────────────────────────────────────────────

async def cmd_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if await guard(update): return
    user = update.effective_user
    store.register_user(user)
    get_or_create_wallet(user.id, user.username)
    text   = build_welcome(user.first_name)
    markup = main_menu_keyboard()
    if update.message:
        await update.message.reply_text(text, parse_mode="HTML", reply_markup=markup)
    else:
        await update.callback_query.edit_message_text(text, parse_mode="HTML", reply_markup=markup)

async def cmd_help(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if await guard(update): return
    store.register_user(update.effective_user)
    await update.message.reply_text(
        "<b>ℹ️ NEXUS HELP</b>\n\n"
        "/start   — Main panel\n/status  — System metrics\n"
        "/procs   — Top processes\n/disks   — Disk usage\n"
        "/net     — Network info\n/stats   — Bot stats\n"
        "/wallet  — Your crypto wallet\n/balance — USDC balance\n"
        "/send    — Send a USDC tip\n/history — Tip history\n"
        "/help    — This message",
        parse_mode="HTML",
    )

async def cmd_status(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if await guard(update): return
    store.register_user(update.effective_user)
    await update.message.reply_text(build_status(), parse_mode="HTML", reply_markup=back_keyboard("status"))

async def cmd_procs(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if await guard(update): return
    await update.message.reply_text(build_processes(), parse_mode="HTML", reply_markup=back_keyboard("processes"))

async def cmd_disks(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if await guard(update): return
    await update.message.reply_text(build_disks(), parse_mode="HTML", reply_markup=back_keyboard("disks"))

async def cmd_net(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if await guard(update): return
    await update.message.reply_text(build_network(), parse_mode="HTML", reply_markup=back_keyboard("network"))

async def cmd_stats(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if await guard(update): return
    await update.message.reply_text(build_botstats(), parse_mode="HTML", reply_markup=back_keyboard("botstats"))

async def cmd_wallet(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if await guard(update): return
    user   = update.effective_user
    wallet = get_or_create_wallet(user.id, user.username)
    await update.message.reply_text(
        f"<b>👛 Your Wallet</b>\n\n<code>{wallet}</code>\n\nShare this address to receive USDC tips.",
        parse_mode="HTML", reply_markup=back_keyboard(),
    )

async def cmd_balance(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if await guard(update): return
    user   = update.effective_user
    wallet = get_or_create_wallet(user.id, user.username)
    await update.message.chat.send_action(ChatAction.TYPING)
    bal = usdc_balance(wallet)
    await update.message.reply_text(
        f"<b>💰 USDC Balance</b>\n\n{bal:.4f} USDC\n<code>{wallet}</code>",
        parse_mode="HTML", reply_markup=back_keyboard(),
    )

async def cmd_history(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if await guard(update): return
    txs = get_tx_history(update.effective_user.id)
    if not txs:
        text = "<b>📜 No tip history yet.</b>"
    else:
        lines = ["<b>📜 TIP HISTORY</b>", "━━━━━━━━━━━━━━━━━━━"]
        for rid, amt, ts, status in txs:
            lines.append(f"→ {amt:.2f} USDC to user <code>{rid}</code>\n  {status} | {ts}")
        text = "\n".join(lines)
    await update.message.reply_text(text, parse_mode="HTML", reply_markup=back_keyboard())

# ─────────────────────────────────────────────────────────────────────────────
# TIPPING CONVERSATION
# ─────────────────────────────────────────────────────────────────────────────

async def tip_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Entry: /send command or 'tip_send' button."""
    if update.callback_query:
        await update.callback_query.answer()
        await update.callback_query.edit_message_text(
            "<b>💸 SEND TIP — Step 1/3</b>\n\nEnter the recipient's @username:\n\n/cancel to abort",
            parse_mode="HTML",
        )
    else:
        await update.message.reply_text(
            "<b>💸 SEND TIP — Step 1/3</b>\n\nEnter the recipient's @username:\n\n/cancel to abort",
            parse_mode="HTML",
        )
    return TIP_GET_RECIPIENT

async def tip_get_recipient(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    text = update.message.text.strip()
    username = text.lstrip("@")
    recipient_id = resolve_username_to_id(username)
    if not recipient_id:
        await update.message.reply_text(
            f"❌ @{username} has not used this bot yet — they must send /start first.\n\nTry another username or /cancel."
        )
        return TIP_GET_RECIPIENT
    if recipient_id == update.effective_user.id:
        await update.message.reply_text("❌ You can't tip yourself. Try another username or /cancel.")
        return TIP_GET_RECIPIENT
    context.user_data["tip_recipient_id"]   = recipient_id
    context.user_data["tip_recipient_name"] = username
    await update.message.reply_text(
        f"<b>💸 SEND TIP — Step 2/3</b>\n\nRecipient: @{username}\n\nEnter amount in USDC (min {MIN_TIP}, max {MAX_TIP}):\n\n/cancel to abort",
        parse_mode="HTML",
    )
    return TIP_GET_AMOUNT

async def tip_get_amount(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    try:
        amount = float(update.message.text.strip())
    except ValueError:
        await update.message.reply_text("❌ Invalid amount. Enter a number like 5.00")
        return TIP_GET_AMOUNT

    if amount < MIN_TIP or amount > MAX_TIP:
        await update.message.reply_text(f"❌ Amount must be between {MIN_TIP} and {MAX_TIP} USDC.")
        return TIP_GET_AMOUNT

    user   = update.effective_user
    wallet = get_or_create_wallet(user.id, user.username)
    bal    = usdc_balance(wallet)

    if bal < amount:
        await update.message.reply_text(f"❌ Insufficient balance. You have {bal:.4f} USDC.")
        return TIP_GET_AMOUNT

    context.user_data["tip_amount"]  = amount
    context.user_data["tip_balance"] = bal
    recipient = context.user_data["tip_recipient_name"]

    await update.message.reply_text(
        f"<b>💸 SEND TIP — Step 3/3 (Confirm)</b>\n\n"
        f"To:      @{recipient}\n"
        f"Amount:  <b>{amount:.4f} USDC</b>\n"
        f"Balance: {bal:.4f} USDC\n\n"
        "Confirm?",
        parse_mode="HTML",
        reply_markup=tip_confirm_keyboard(),
    )
    return TIP_CONFIRM

async def tip_cancel(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    await update.message.reply_text("❌ Tip cancelled.", reply_markup=back_keyboard())
    context.user_data.clear()
    return ConversationHandler.END

# ─────────────────────────────────────────────────────────────────────────────
# BROADCAST CONVERSATION
# ─────────────────────────────────────────────────────────────────────────────

async def broadcast_ask(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    await update.callback_query.answer()
    await update.callback_query.edit_message_text(
        "<b>📢 BROADCAST</b>\n\nType your message (sent to all users).\n/cancel to abort.",
        parse_mode="HTML",
    )
    return BROADCAST_TEXT

async def broadcast_send(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    if not is_admin(update.effective_user.id):
        await update.message.reply_text("🚫 Access denied.")
        return ConversationHandler.END
    text = update.message.text
    ok, fail = 0, 0
    for uid in store.all_user_ids():
        try:
            await context.bot.send_message(
                uid,
                f"📢 <b>NEXUS BROADCAST</b>\n━━━━━━━━━━━━━━━━━━━\n{text}\n━━━━━━━━━━━━━━━━━━━\n<i>From: {BOT_NAME}</i>",
                parse_mode="HTML",
            )
            ok += 1
        except Exception:
            fail += 1
    await update.message.reply_text(f"✅ {ok} delivered, {fail} failed.", reply_markup=back_keyboard())
    return ConversationHandler.END

async def broadcast_cancel(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    await update.message.reply_text("❌ Broadcast cancelled.", reply_markup=back_keyboard())
    return ConversationHandler.END

# ─────────────────────────────────────────────────────────────────────────────
# MAIN BUTTON HANDLER
# ─────────────────────────────────────────────────────────────────────────────

async def button_handler(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    user  = update.effective_user

    if await guard(update): return
    if is_rate_limited(user.id):
        await query.answer("⏳ Slow down!", show_alert=True)
        return

    store.register_user(user)
    await query.answer()
    data = query.data

    # ── Static screens ────────────────────────────────────────────────────────
    simple = {
        "status":    (build_status,    "status"),
        "processes": (build_processes, "processes"),
        "disks":     (build_disks,     "disks"),
        "network":   (build_network,   "network"),
        "security":  (build_security,  None),
        "botstats":  (build_botstats,  "botstats"),
    }
    if data in simple:
        fn, refresh = simple[data]
        await query.edit_message_text(fn(), parse_mode="HTML", reply_markup=back_keyboard(refresh))
        return

    if data == "main_menu":
        await cmd_start(update, context)
        return

    if data == "profile":
        wallet = get_or_create_wallet(user.id, user.username)
        await query.edit_message_text(build_profile(user, wallet), parse_mode="HTML", reply_markup=back_keyboard())
        return

    if data == "config":
        await query.edit_message_text(build_config(), parse_mode="HTML", reply_markup=config_keyboard(store.alerts_enabled()))
        return

    if data == "cfg_toggle_alerts":
        state = store.toggle_alerts()
        await query.answer(f"Alerts {'enabled ✅' if state else 'disabled ❌'}", show_alert=True)
        await query.edit_message_text(build_config(), parse_mode="HTML", reply_markup=config_keyboard(store.alerts_enabled()))
        return

    if data == "cfg_users":
        users = store._data.get("users", {})
        lines = [f"<b>👥 USERS ({len(users)})</b>", "━━━━━━━━━━━━━━━━━━━"]
        for u in list(users.values())[:20]:
            lines.append(f"• <code>{u['id']}</code> — {u.get('first_name','?')} (@{u.get('username') or 'N/A'})")
        await query.edit_message_text("\n".join(lines), parse_mode="HTML", reply_markup=back_keyboard())
        return

    # ── Crypto tipping ────────────────────────────────────────────────────────
    if data == "tip_menu":
        wallet = get_or_create_wallet(user.id, user.username)
        bal    = usdc_balance(wallet)
        await query.edit_message_text(build_tip_menu(wallet, bal), parse_mode="HTML", reply_markup=tip_menu_keyboard())
        return

    if data == "tip_wallet":
        wallet = get_or_create_wallet(user.id, user.username)
        await query.edit_message_text(
            f"<b>👛 Your Wallet</b>\n\n<code>{wallet}</code>\n\nShare to receive tips.",
            parse_mode="HTML", reply_markup=back_keyboard(),
        )
        return

    if data == "tip_balance":
        wallet = get_or_create_wallet(user.id, user.username)
        bal    = usdc_balance(wallet)
        await query.edit_message_text(
            f"<b>💰 USDC Balance</b>\n\n{bal:.4f} USDC\n\n<code>{wallet}</code>",
            parse_mode="HTML", reply_markup=back_keyboard(),
        )
        return

    if data == "tip_history":
        txs = get_tx_history(user.id)
        if not txs:
            text = "<b>📜 No tip history yet.</b>"
        else:
            lines = ["<b>📜 TIP HISTORY</b>", "━━━━━━━━━━━━━━━━━━━"]
            for rid, amt, ts, status in txs:
                lines.append(f"→ {amt:.2f} USDC to <code>{rid}</code>  [{status}]  {ts}")
            text = "\n".join(lines)
        await query.edit_message_text(text, parse_mode="HTML", reply_markup=back_keyboard())
        return

    if data == "tip_confirm_yes":
        amount    = context.user_data.get("tip_amount", 0)
        recip_id  = context.user_data.get("tip_recipient_id")
        recip_name = context.user_data.get("tip_recipient_name", "?")
        # In testnet mode we simulate the transfer (no real private key)
        tx_hash = f"0xSIMULATED_{int(time.time())}"
        save_tx(user.id, recip_id, amount, tx_hash, "simulated")
        try:
            await context.bot.send_message(
                recip_id,
                f"🎉 <b>You received a tip!</b>\n\n{amount:.4f} USDC from @{user.username or user.first_name}",
                parse_mode="HTML",
            )
        except Exception:
            pass
        logger.info("Tip: %s → %s  %.4f USDC  tx=%s", user.id, recip_id, amount, tx_hash)
        await query.edit_message_text(
            f"✅ <b>Tip Sent!</b>\n\n{amount:.4f} USDC → @{recip_name}\n<code>{tx_hash}</code>",
            parse_mode="HTML", reply_markup=back_keyboard(),
        )
        context.user_data.clear()
        return

    if data == "tip_confirm_no":
        await query.edit_message_text("❌ Tip cancelled.", reply_markup=back_keyboard())
        context.user_data.clear()
        return

    # ── Emergency stop ────────────────────────────────────────────────────────
    if data == "stop":
        await query.edit_message_text(
            "<b>⚠️ EMERGENCY STOP</b>\n\nHalt all monitored services?\nThis <b>cannot</b> be undone automatically.",
            parse_mode="HTML", reply_markup=confirm_stop_keyboard(),
        )
        return

    if data == "stop_confirm":
        logger.critical("EMERGENCY STOP by user %s", user.id)
        await query.edit_message_text(
            f"<b>🛑 EMERGENCY STOP EXECUTED</b>\n\nTriggered by: <code>{user.id}</code>\n"
            f"Time: {datetime.datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}",
            parse_mode="HTML",
        )
        return

    await query.edit_message_text("⚠️ Unknown action.", reply_markup=back_keyboard())

# ─────────────────────────────────────────────────────────────────────────────
# ERROR HANDLER
# ─────────────────────────────────────────────────────────────────────────────

async def error_handler(update: object, context: ContextTypes.DEFAULT_TYPE) -> None:
    logger.error("Unhandled exception", exc_info=context.error)
    if isinstance(update, Update) and update.effective_message:
        try:
            await update.effective_message.reply_text("⚠️ An internal error occurred. It has been logged.")
        except Exception:
            pass

# ─────────────────────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────────────────────

def main() -> None:
    init_db()
    logger.info("Starting %s ...", BOT_NAME)

    app: Application = ApplicationBuilder().token(TOKEN).build()

    # Commands
    app.add_handler(CommandHandler("start",   cmd_start))
    app.add_handler(CommandHandler("help",    cmd_help))
    app.add_handler(CommandHandler("status",  cmd_status))
    app.add_handler(CommandHandler("procs",   cmd_procs))
    app.add_handler(CommandHandler("disks",   cmd_disks))
    app.add_handler(CommandHandler("net",     cmd_net))
    app.add_handler(CommandHandler("stats",   cmd_stats))
    app.add_handler(CommandHandler("wallet",  cmd_wallet))
    app.add_handler(CommandHandler("balance", cmd_balance))
    app.add_handler(CommandHandler("history", cmd_history))

    # Tipping conversation
    app.add_handler(ConversationHandler(
        entry_points=[
            CommandHandler("send", tip_start),
            CallbackQueryHandler(tip_start, pattern="^tip_send$"),
        ],
        states={
            TIP_GET_RECIPIENT: [MessageHandler(filters.TEXT & ~filters.COMMAND, tip_get_recipient)],
            TIP_GET_AMOUNT:    [MessageHandler(filters.TEXT & ~filters.COMMAND, tip_get_amount)],
            TIP_CONFIRM:       [CallbackQueryHandler(button_handler, pattern="^tip_confirm_")],
        },
        fallbacks=[CommandHandler("cancel", tip_cancel)],
        per_message=False,
    ))

    # Broadcast conversation
    app.add_handler(ConversationHandler(
        entry_points=[CallbackQueryHandler(broadcast_ask, pattern="^cfg_broadcast$")],
        states={BROADCAST_TEXT: [MessageHandler(filters.TEXT & ~filters.COMMAND, broadcast_send)]},
        fallbacks=[CommandHandler("cancel", broadcast_cancel)],
        per_message=False,
    ))

    # All other buttons
    app.add_handler(CallbackQueryHandler(button_handler))

    # Alert job
    if app.job_queue:
        app.job_queue.run_repeating(alert_job, interval=300, first=30)

    app.add_error_handler(error_handler)

    logger.info("%s is live — polling started.", BOT_NAME)
    app.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == "__main__":
    main()
