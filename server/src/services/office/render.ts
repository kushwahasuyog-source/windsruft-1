import dns from 'node:dns/promises';
import net from 'node:net';
import puppeteer from 'puppeteer-core';
import { AppError } from '../../errors';

export interface HtmlRenderOptions {
  pageSize: 'A4' | 'Letter';
  orientation: 'portrait' | 'landscape';
  margin: number;
  printBackground: boolean;
}

function privateAddress(address: string): boolean {
  if (net.isIPv4(address)) {
    const [a, b] = address.split('.').map(Number);
    return a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254) || a === 0;
  }
  if (net.isIPv6(address)) {
    const normalized = address.toLowerCase();
    return normalized === '::1' || normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('fe80:');
  }
  return true;
}

export async function assertPublicUrl(value: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new AppError('PROCESSING_FAILED', 400, 'Enter a valid public http or https URL.');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new AppError('PROCESSING_FAILED', 400, 'Only public http and https URLs are supported.');
  }
  const addresses = await dns.lookup(url.hostname, { all: true });
  if (!addresses.length || addresses.some((entry) => privateAddress(entry.address))) {
    throw new AppError('PROCESSING_FAILED', 400, 'That URL points to a private or local network address.');
  }
  return url;
}

export async function renderHtmlToPdf(
  output: string,
  options: HtmlRenderOptions,
  content: { html?: string; url?: string },
): Promise<void> {
  if (!content.html && !content.url) throw new AppError('PROCESSING_FAILED', 400, 'Provide HTML content or a public URL.');
  let browser;
  try {
    browser = await puppeteer.launch({
      executablePath: process.env.CHROME_PATH || '/home/ubuntu/.local/bin/google-chrome',
      headless: true,
      args: ['--no-sandbox'],
    });
  } catch (error) {
    const details = error as { code?: string };
    if (details.code === 'ENOENT') throw new AppError('ENGINE_UNAVAILABLE', 503, 'The Chrome rendering engine is unavailable.');
    throw new AppError('ENGINE_UNAVAILABLE', 503, 'The Chrome rendering engine could not be started.');
  }
  try {
    const page = await browser.newPage();
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      void assertPublicUrl(request.url()).then(() => request.continue()).catch(() => request.abort());
    });
    if (content.url) {
      await assertPublicUrl(content.url);
      await page.goto(content.url, { waitUntil: 'networkidle0', timeout: 30_000 });
    } else {
      await page.setContent(content.html ?? '', { waitUntil: 'networkidle0', timeout: 30_000 });
    }
    await page.pdf({
      path: output,
      format: options.pageSize,
      landscape: options.orientation === 'landscape',
      printBackground: options.printBackground,
      margin: { top: `${options.margin / 72}in`, right: `${options.margin / 72}in`, bottom: `${options.margin / 72}in`, left: `${options.margin / 72}in` },
    });
  } catch {
    throw new AppError('PROCESSING_FAILED', 422, 'The HTML could not be rendered as a PDF.');
  } finally {
    await browser.close();
  }
}
