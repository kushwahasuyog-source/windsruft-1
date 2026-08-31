import { AppError } from '../../errors';

export interface ImageConversionOptions { format: 'pdf' | 'jpg' | 'png'; }
export async function convertImage(_input: string, _output: string, _options: ImageConversionOptions): Promise<never> {
  throw new AppError('ENGINE_UNAVAILABLE', 503, 'Image conversion is coming in this build.');
}
