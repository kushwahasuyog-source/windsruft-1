import { AppError } from '../../errors';

export interface SecurityOptions { password?: string; }
export async function runSecurity(_input: string, _options: SecurityOptions): Promise<never> {
  throw new AppError('ENGINE_UNAVAILABLE', 503, 'Security tools are coming in this build.');
}
