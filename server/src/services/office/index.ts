import { AppError } from '../../errors';

export interface OfficeConversionOptions { format: 'pdf'; }
export async function convertOffice(_input: string, _output: string, _options: OfficeConversionOptions): Promise<never> {
  throw new AppError('ENGINE_UNAVAILABLE', 503, 'Office conversion is coming in this build.');
}
