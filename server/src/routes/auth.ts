import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { AppError } from '../errors';

const router = Router();
const authLimit = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS ?? 900_000),
  max: Number(process.env.RATE_LIMIT_AI_MAX ?? 10),
  standardHeaders: true,
  legacyHeaders: false,
});

async function notConfigured() {
  throw new AppError('NOT_CONFIGURED', 503, 'Authentication is not configured on this server.');
}

router.post('/login', authLimit, async (_request, _response, next) => {
  try { await notConfigured(); } catch (error) { next(error); }
});
router.post('/signup', authLimit, async (_request, _response, next) => {
  try { await notConfigured(); } catch (error) { next(error); }
});
router.post('/google', authLimit, async (_request, _response, next) => {
  try { await notConfigured(); } catch (error) { next(error); }
});

export default router;
