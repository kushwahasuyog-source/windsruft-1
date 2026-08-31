import 'dotenv/config';
import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import { AppError, toAppError } from './errors';
import pdfRoutes from './routes/pdf';
import convertRoutes from './routes/convert';
import authRoutes from './routes/auth';
import { detectCapabilities } from './services/capabilities';
import { serveFile, sweepWorkspaces } from './services/storage/workspace';

const app = express();
const port = Number(process.env.PORT ?? 5000);

app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173' }));
app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use((request, _response, next) => {
  console.log(`${request.method} ${request.path}`);
  next();
});

const apiLimit = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS ?? 900_000),
  max: Number(process.env.RATE_LIMIT_MAX ?? 100),
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_request, _response, next) => {
    next(new AppError('RATE_LIMITED', 429, 'Too many requests. Please try again later.'));
  },
});

app.use('/api', apiLimit);
app.use('/api/pdf', pdfRoutes);
app.use('/api/convert', convertRoutes);
app.use('/api/pdf', convertRoutes);
app.use('/api/auth', authRoutes);
app.get('/api/capabilities', async (_request, response, next) => {
  try {
    response.json(await detectCapabilities());
  } catch (error) {
    next(error);
  }
});
app.get('/api/files/:jobId/:fileId', async (request, response, next) => {
  try {
    await serveFile(response, request.params.jobId, request.params.fileId, request.query.inline === '1');
  } catch (error) {
    next(error);
  }
});
app.use((_request, response) => {
  response.status(404).json({ error: { code: 'NOT_FOUND', message: 'The requested resource was not found.' } });
});
app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
  const appError = error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE'
    ? new AppError('FILE_TOO_LARGE', 413, 'The file is too large.')
    : toAppError(error);
  response.status(appError.httpStatus).json({
    error: { code: appError.code, message: appError.message },
  });
});

void sweepWorkspaces();
setInterval(() => void sweepWorkspaces(), 300_000);
app.listen(port, () => console.log(`PDFForge API listening on http://localhost:${port}`));

export default app;
