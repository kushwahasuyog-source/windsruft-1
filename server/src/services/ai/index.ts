import { AppError } from '../../errors';

export interface AiOptions { model?: string; }
export async function runAi(_input: string, _options: AiOptions): Promise<never> {
  throw new AppError('ENGINE_UNAVAILABLE', 503, 'AI tools are coming in this build.');
}
