import { useCallback, useEffect, useRef, useState } from 'react';
import type { JobResponse } from '@shared/tools';
import { ApiClientError, apiClient } from '../services/apiClient';

export type QueueStatus = 'WAITING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
export interface QueueItem {
  id: string;
  file: File;
  status: QueueStatus;
  progress: number;
  error?: string;
  result?: JobResponse;
}

export type QueueOptions = Record<string, string | number | boolean | File>;

function makeId(file: File): string {
  return `${file.name}:${file.size}:${file.lastModified}:${Math.random().toString(36).slice(2)}`;
}

export interface StandaloneJob {
  label: string;
  status: QueueStatus;
  error?: string;
  result?: JobResponse;
}

export function useFileQueue() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [standalone, setStandalone] = useState<StandaloneJob>();
  const [processing, setProcessing] = useState(false);
  const controller = useRef<AbortController>();
  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const update = useCallback((id: string, changes: Partial<QueueItem>) => {
    setItems((current) => current.map((item) => item.id === id ? { ...item, ...changes } : item));
  }, []);
  const add = useCallback((files: File[]) => setItems((current) => {
    const unique = files.filter((file) => !current.some((item) => item.file.name === file.name && item.file.size === file.size));
    return [...current, ...unique.map((file) => ({ id: makeId(file), file, status: 'WAITING' as const, progress: 0 }))];
  }), []);
  const remove = useCallback((id: string) => setItems((current) => current.filter((item) => item.id !== id)), []);

  const runOne = useCallback(async (
    tool: string,
    item: QueueItem,
    options: QueueOptions,
  ): Promise<JobResponse> => {
    const config = {
      signal: controller.current?.signal,
      onUploadProgress: (event: { loaded: number; total?: number }) => {
        const progress = event.total ? Math.min(100, Math.round((event.loaded / event.total) * 100)) : 0;
        update(item.id, { progress });
      },
    };
    update(item.id, { status: 'PROCESSING', progress: 0, error: undefined });
    if (tool === 'compress') return apiClient.compress([item.file], String(options.level ?? 'recommended'), config);
    if (tool === 'split') return apiClient.split(item.file, String(options.mode ?? 'every-page'), String(options.ranges ?? ''), config);
    if (tool === 'rotate') return apiClient.rotate(item.file, String(options.pages ?? 'all'), Number(options.angle ?? 90), config);
    if (tool === 'remove-pages') return apiClient.removePages(item.file, String(options.pages ?? '[]'), config);
    if (tool === 'extract-pages') return apiClient.extractPages(item.file, String(options.pages ?? '[]'), String(options.ranges ?? ''), config);
    if (tool === 'organize') return apiClient.organize(item.file, String(options.ops ?? '[]'), config);
    if (tool === 'page-numbers') return apiClient.pageNumbers(item.file, {
      position: String(options.position ?? 'bottom-center'),
      format: String(options.format ?? 'Page 1 of 10'),
      fontFamily: String(options.fontFamily ?? 'Helvetica'),
      fontSize: Number(options.fontSize ?? 12),
      color: String(options.color ?? '#111827'),
      startNumber: Number(options.startNumber ?? 1),
      pages: String(options.pages ?? 'all'),
    }, config);
    if (tool === 'watermark') return apiClient.watermark(item.file, options as Record<string, string | number | boolean>, config);
    if (tool === 'crop') return apiClient.crop(item.file, String(options.box ?? '{}'), String(options.applyTo ?? 'page'), Number(options.page ?? 1), config);
    if (tool === 'protect') return apiClient.protect(item.file, options as Record<string, string | number | boolean>, config);
    if (tool === 'unlock') return apiClient.unlock(item.file, String(options.password ?? ''), config);
    if (tool === 'repair') return apiClient.repair(item.file, config);
    if (tool === 'ocr') return apiClient.ocr(item.file, { language: String(options.language ?? 'eng'), dpi: Number(options.dpi ?? 250) }, config);
    if (tool === 'word-to-pdf') return apiClient.officeToPdf('/api/convert/word-to-pdf', item.file, config);
    if (tool === 'powerpoint-to-pdf') return apiClient.officeToPdf('/api/convert/ppt-to-pdf', item.file, config);
    if (tool === 'excel-to-pdf') return apiClient.officeToPdf('/api/convert/excel-to-pdf', item.file, config);
    if (tool === 'pdf-to-jpg') return apiClient.pdfToJpg(item.file, {
      format: String(options.format ?? 'jpg'),
      quality: Number(options.quality ?? 85),
      dpi: Number(options.dpi ?? 150),
      pages: String(options.pages ?? 'all'),
    }, config);
    if (tool === 'pdf-to-word') return apiClient.pdfToWord(item.file, config);
    if (tool === 'pdf-to-powerpoint') return apiClient.pdfToPpt(item.file, config);
    if (tool === 'pdf-to-excel') return apiClient.pdfToExcel(item.file, config);
    if (tool === 'pdf-to-pdfa') return apiClient.pdfToPdfa(item.file, config);
    if (tool === 'html-to-pdf') return apiClient.htmlToPdf({
      mode: options.mode === 'file' ? 'html' : String(options.mode ?? 'html'),
      html: String(options.html ?? ''),
      url: String(options.url ?? ''),
      pageSize: String(options.pageSize ?? 'A4'),
      orientation: String(options.orientation ?? 'portrait'),
      margin: Number(options.margin ?? 24),
      printBackground: Boolean(options.printBackground ?? true),
    }, options.mode === 'file' ? item.file : options.htmlFile instanceof File ? options.htmlFile : undefined, config);
    throw new Error('Unsupported PDF operation.');
  }, [update]);

  const processStandalone = useCallback(async (label: string, options: QueueOptions) => {
    const abortController = new AbortController();
    controller.current = abortController;
    setProcessing(true);
    setStandalone({ label, status: 'PROCESSING' });
    try {
      const result = await apiClient.htmlToPdf({
        mode: String(options.mode ?? 'html'),
        html: String(options.html ?? ''),
        url: String(options.url ?? ''),
        pageSize: String(options.pageSize ?? 'A4'),
        orientation: String(options.orientation ?? 'portrait'),
        margin: Number(options.margin ?? 24),
        printBackground: Boolean(options.printBackground ?? true),
      }, undefined, { signal: abortController.signal });
      setStandalone({ label, status: 'COMPLETED', result });
      return result;
    } catch (error) {
      setStandalone({
        label,
        status: 'FAILED',
        error: error instanceof ApiClientError ? error.message : 'Something went wrong while processing your request. Please try again.',
      });
      return undefined;
    } finally {
      setProcessing(false);
      controller.current = undefined;
    }
  }, []);

  const process = useCallback(async (tool: string, options: QueueOptions = {}) => {
    const currentItems = itemsRef.current.filter((item) => item.status !== 'COMPLETED');
    if (!currentItems.length) return;
    const abortController = new AbortController();
    controller.current = abortController;
    setProcessing(true);
    try {
      if (tool === 'merge') {
        try {
          const order = options.order ? JSON.parse(String(options.order)) as number[] : currentItems.map((_item, index) => index);
          const rotations = options.rotations ? JSON.parse(String(options.rotations)) as number[] : currentItems.map(() => 0);
          currentItems.forEach((item) => update(item.id, { status: 'PROCESSING', progress: 0, error: undefined }));
          const result = await apiClient.merge(currentItems.map((item) => item.file), order, rotations, {
            signal: abortController.signal,
            onUploadProgress: (event) => {
              const progress = event.total ? Math.min(100, Math.round((event.loaded / event.total) * 100)) : 0;
              currentItems.forEach((item) => update(item.id, { progress }));
            },
          });
          update(currentItems[0].id, { status: 'COMPLETED', progress: 100, result });
          currentItems.slice(1).forEach((item) => update(item.id, { status: 'COMPLETED', progress: 100, result }));
        } catch (error) {
          const message = error instanceof ApiClientError
            ? error.message
            : 'Something went wrong while processing your file. Please try again.';
          currentItems.forEach((item) => update(item.id, { status: 'FAILED', error: message }));
        }
      } else if (tool === 'jpg-to-pdf' || tool === 'scan-to-pdf') {
        try {
          currentItems.forEach((item) => update(item.id, { status: 'PROCESSING', progress: 0, error: undefined }));
          const order = options.order ? JSON.parse(String(options.order)) as number[] : currentItems.map((_item, index) => index);
          const orderedItems = order.map((index) => currentItems[index]).filter((item): item is QueueItem => Boolean(item));
          const result = tool === 'jpg-to-pdf'
            ? await apiClient.imagesToPdf(orderedItems.map((item) => item.file), options as Record<string, string | number | boolean>, { signal: abortController.signal, onUploadProgress: (event) => currentItems.forEach((item) => update(item.id, { progress: event.total ? Math.round((event.loaded / event.total) * 100) : 0 })) })
            : await apiClient.scanToPdf(orderedItems.map((item) => item.file), options as Record<string, string | number | boolean>, { signal: abortController.signal, onUploadProgress: (event) => currentItems.forEach((item) => update(item.id, { progress: event.total ? Math.round((event.loaded / event.total) * 100) : 0 })) });
          currentItems.forEach((item) => update(item.id, { status: 'COMPLETED', progress: 100, result }));
        } catch (error) {
          const message = error instanceof ApiClientError ? error.message : 'Something went wrong while processing your file. Please try again.';
          currentItems.forEach((item) => update(item.id, { status: 'FAILED', error: message }));
        }
      } else {
        for (const item of currentItems) {
          try {
            const result = await runOne(tool, item, options);
            update(item.id, { status: 'COMPLETED', progress: 100, result });
          } catch (error) {
            const message = error instanceof ApiClientError
              ? error.message
              : 'Something went wrong while processing your file. Please try again.';
            update(item.id, { status: 'FAILED', error: message });
          }
        }
      }
    } finally {
      setProcessing(false);
      controller.current = undefined;
    }
  }, [runOne, update]);

  const retry = useCallback(async (id: string, tool: string, options: QueueOptions = {}) => {
    const item = itemsRef.current.find((candidate) => candidate.id === id);
    if (!item) return;
    const abortController = new AbortController();
    controller.current = abortController;
    setProcessing(true);
    try {
      const result = await runOne(tool, item, options);
      update(id, { status: 'COMPLETED', progress: 100, result });
    } catch (error) {
      update(id, {
        status: 'FAILED',
        error: error instanceof ApiClientError ? error.message : 'Something went wrong while processing your file. Please try again.',
      });
    } finally {
      setProcessing(false);
      controller.current = undefined;
    }
  }, [runOne, update]);

  return {
    items,
    processing,
    standalone,
    add,
    remove,
    process,
    processStandalone,
    retry,
    cancel: () => controller.current?.abort(),
    clear: () => {
      setItems([]);
      setStandalone(undefined);
    },
  };
}
