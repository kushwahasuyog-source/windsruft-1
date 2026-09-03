import { useId, useRef, useState } from 'react';
import type { DragEvent, KeyboardEvent } from 'react';
import type { AcceptedType } from '@shared/tools';
import { Card } from './ui/Primitives';

function acceptValue(types: AcceptedType[]): string {
  return types.map((type) => {
    if (type === 'pdf') return '.pdf,application/pdf';
    if (type === 'image') return 'image/*';
    if (type === 'html') return '.html,.htm,text/html';
    return `.${type},application/${type}`;
  }).join(',');
}

export function FileDropzone({
  accepts,
  multiple,
  maxSizeMb = 50,
  onFiles,
}: {
  accepts: AcceptedType[];
  multiple: boolean;
  maxSizeMb?: number;
  onFiles: (files: File[]) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const descriptionId = useId();
  const [error, setError] = useState('');
  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const candidates = Array.from(list).filter((file, index, files) =>
      files.findIndex((other) => other.name === file.name && other.size === file.size) === index,
    );
    const accepted = candidates.filter((file) => {
      const extension = file.name.split('.').pop()?.toLowerCase();
      const validType = accepts.some((type) => type === 'pdf'
        ? extension === 'pdf' || file.type === 'application/pdf'
        : type === 'image' ? file.type.startsWith('image/')
          : extension === type);
      return validType && file.size <= maxSizeMb * 1024 * 1024;
    });
    if (accepted.length !== candidates.length) setError(`Choose ${accepts.join(', ')} files up to ${maxSizeMb} MB.`);
    else setError('');
    onFiles(multiple ? accepted : accepted.slice(0, 1));
  };
  const handleKey = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      input.current?.click();
    }
  };
  const handleDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    addFiles(event.dataTransfer.files);
  };
  return (
    <Card
      className="cursor-pointer border-dashed bg-sunken text-center transition hover:border-accent"
      role="button"
      tabIndex={0}
      aria-describedby={descriptionId}
      onClick={() => input.current?.click()}
      onKeyDown={handleKey}
      onDragOver={(event) => event.preventDefault()}
      onDrop={handleDrop}
    >
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft text-2xl text-accent">↑</div>
      <h3 className="text-lg font-bold">Drop files here or browse</h3>
      <p id={descriptionId} className="mt-2 text-sm text-muted">
        Accepted: {accepts.join(', ')} · Up to {maxSizeMb} MB per file
      </p>
      {error && <p className="mt-2 text-sm text-danger" role="alert">{error}</p>}
      <input ref={input} hidden type="file" accept={acceptValue(accepts)} multiple={multiple} onChange={(event) => addFiles(event.target.files)} />
    </Card>
  );
}
