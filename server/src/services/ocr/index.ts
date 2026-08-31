import { AppError } from '../../errors';

export interface OcrOptions { language?: string; }
export async function runOcr(_input: string, _options: OcrOptions): Promise<never> {
  throw new AppError('ENGINE_UNAVAILABLE', 503, 'OCR is coming in this build.');
}
