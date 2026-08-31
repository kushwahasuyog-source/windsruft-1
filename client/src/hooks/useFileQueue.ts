import { useState } from 'react';
import type { JobResponse } from '@shared/tools';
import { ApiClientError, apiClient } from '../services/apiClient';

export type QueueStatus = 'WAITING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
export interface QueueItem {
  file: File;
  status: QueueStatus;
  error?: string;
  result?: JobResponse;
}

export function useFileQueue() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [controller, setController] = useState<AbortController>();
  const add = (files: File[]) => setItems((current) => [
    ...current,
    ...files.map((file) => ({ file, status: 'WAITING' as const })),
  ]);
  const remove = (index: number) => setItems((current) => current.filter((_item, itemIndex) => itemIndex !== index));
  const process = async (tool: string, options: Record<string, string | number> = {}) => {
    const abortController = new AbortController();
    setController(abortController);
    const currentItems = [...items];
    for (let index = 0; index < currentItems.length; index += 1) {
      setItems((current) => current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, status: 'PROCESSING' } : item,
      ));
      try {
        let result: JobResponse;
        const config = { signal: abortController.signal };
        if (tool === 'compress') {
          result = await apiClient.compress([currentItems[index].file], String(options.level ?? 'recommended'), config);
        } else if (tool === 'merge') {
          result = await apiClient.merge(currentItems.map((item) => item.file), config);
        } else if (tool === 'split') {
          result = await apiClient.split(currentItems[index].file, String(options.mode ?? 'every-page'), String(options.ranges ?? ''), config);
        } else {
          result = await apiClient.rotate(currentItems[index].file, String(options.pages ?? 'all'), Number(options.angle ?? 90), config);
        }
        setItems((current) => current.map((item, itemIndex) =>
          itemIndex === index ? { ...item, status: 'COMPLETED', result } : item,
        ));
        if (tool === 'merge') break;
      } catch (error) {
        const message = error instanceof ApiClientError
          ? error.message
          : 'Something went wrong while processing your file. Please try again.';
        setItems((current) => current.map((item, itemIndex) =>
          itemIndex === index ? { ...item, status: 'FAILED', error: message } : item,
        ));
      }
    }
  };
  return {
    items,
    add,
    remove,
    process,
    cancel: () => controller?.abort(),
    clear: () => setItems([]),
  };
}
