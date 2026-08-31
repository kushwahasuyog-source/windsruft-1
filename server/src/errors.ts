export type ErrorCode =
  | 'INVALID_FILE_TYPE'
  | 'FILE_TOO_LARGE'
  | 'CORRUPT_PDF'
  | 'PASSWORD_REQUIRED'
  | 'WRONG_PASSWORD'
  | 'ENGINE_UNAVAILABLE'
  | 'PROCESSING_FAILED'
  | 'RATE_LIMITED'
  | 'NOT_CONFIGURED'
  | 'NOT_FOUND';

export class AppError extends Error {
  public readonly name = 'AppError';

  public constructor(
    public readonly code: ErrorCode,
    public readonly httpStatus: number,
    message: string,
  ) {
    super(message);
  }
}

export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  return new AppError(
    'PROCESSING_FAILED',
    500,
    'Something went wrong while processing your file. Please try again.',
  );
}
