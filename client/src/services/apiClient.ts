import axios, { type AxiosError, type AxiosRequestConfig } from 'axios';
import type { ApiErrorBody, JobResponse } from '@shared/tools';

const messages: Record<string, string> = {
  INVALID_FILE_TYPE: 'Please select a PDF file.',
  FILE_TOO_LARGE: 'The file is too large.',
  CORRUPT_PDF: 'The PDF appears to be corrupted.',
  PASSWORD_REQUIRED: 'This PDF requires a password.',
  WRONG_PASSWORD: 'The password is incorrect.',
  PROCESSING_FAILED: 'Something went wrong while processing your file. Please try again.',
  ENGINE_UNAVAILABLE: 'This tool is not configured on this server.',
};

export class ApiClientError extends Error {
  public constructor(public readonly code: string, message: string) {
    super(message);
  }
}

function normalizeError(error: unknown): never {
  const response = (error as AxiosError<ApiErrorBody>).response;
  const code = response?.data?.error?.code ?? 'PROCESSING_FAILED';
  throw new ApiClientError(code, messages[code] ?? messages.PROCESSING_FAILED);
}

async function upload(
  endpoint: string,
  files: File[],
  fields: Record<string, string>,
  fieldName: 'file' | 'files',
  config?: Pick<AxiosRequestConfig, 'onUploadProgress' | 'signal'>,
): Promise<JobResponse> {
  const body = new FormData();
  files.forEach((file) => body.append(fieldName, file));
  Object.entries(fields).forEach(([key, value]) => body.append(key, value));
  try {
    return (await axios.post<JobResponse>(endpoint, body, config)).data;
  } catch (error) {
    return normalizeError(error);
  }
}

export const apiClient = {
  compress: (files: File[], level: string, config?: Pick<AxiosRequestConfig, 'onUploadProgress' | 'signal'>) =>
    upload('/api/pdf/compress', files, { level }, 'files', config),
  merge: (files: File[], order: number[], rotations: number[], config?: Pick<AxiosRequestConfig, 'onUploadProgress' | 'signal'>) =>
    upload('/api/pdf/merge', files, { order: JSON.stringify(order), rotations: JSON.stringify(rotations) }, 'files', config),
  split: (file: File, mode: string, ranges: string, config?: Pick<AxiosRequestConfig, 'onUploadProgress' | 'signal'>) =>
    upload('/api/pdf/split', [file], { mode, ranges }, 'file', config),
  rotate: (file: File, pages: string, angle: number, config?: Pick<AxiosRequestConfig, 'signal'>) =>
    upload('/api/pdf/rotate', [file], { pages, angle: String(angle) }, 'file', config),
  pageInfo: async (file: File) => {
    const body = new FormData();
    body.append('file', file);
    try {
      return (await axios.post<{ pages: number; sizes: Array<{ width: number; height: number }>; metadata: { title?: string; author?: string; subject?: string } }>('/api/pdf/page-info', body)).data;
    } catch (error) {
      return normalizeError(error);
    }
  },
};
