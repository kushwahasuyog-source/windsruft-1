import type { ReactNode } from 'react';
import { Button } from './ui/Primitives';

export interface SortableItem {
  id: string;
}

export function SortableList<T extends SortableItem>({
  items,
  onReorder,
  renderItem,
}: {
  items: T[];
  onReorder: (from: number, to: number) => void;
  renderItem: (item: T, index: number) => ReactNode;
}) {
  return (
    <div className="space-y-2">
      {items.map((item, index) => (
        <div
          key={item.id}
          draggable
          onDragStart={(event) => event.dataTransfer.setData('text/plain', item.id)}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            const from = items.findIndex((candidate) => candidate.id === event.dataTransfer.getData('text/plain'));
            if (from >= 0 && from !== index) onReorder(from, index);
          }}
          className="rounded-lg border border-subtle"
        >
          {renderItem(item, index)}
          <div className="flex justify-end gap-2 px-3 pb-3">
            <Button
              className="border border-subtle px-3 text-sm"
              aria-label={`Move item ${index + 1} up`}
              onClick={() => onReorder(index, index - 1)}
              disabled={index === 0}
            >
              ↑
            </Button>
            <Button
              className="border border-subtle px-3 text-sm"
              aria-label={`Move item ${index + 1} down`}
              onClick={() => onReorder(index, index + 1)}
              disabled={index === items.length - 1}
            >
              ↓
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
