import axios, { type AxiosError } from 'axios';
import type { ApiErrorBody } from '@shared/tools';

export class AuthServiceError extends Error {
  public constructor(public readonly code: string, message: string) {
    super(message);
  }
}

async function request(path: string, email?: string, password?: string): Promise<void> {
  try {
    await axios.post(path, email && password ? { email, password } : {});
  } catch (error) {
    const response = (error as AxiosError<ApiErrorBody>).response;
    const code = response?.data?.error?.code ?? 'PROCESSING_FAILED';
    throw new AuthServiceError(code, response?.data?.error?.message ?? 'Something went wrong. Please try again.');
  }
}

export const authService = {
  login: (email: string, password: string) => request('/api/auth/login', email, password),
  signup: (email: string, password: string) => request('/api/auth/signup', email, password),
  google: () => request('/api/auth/google'),
};
