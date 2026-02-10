'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { ItemDetailDrawer } from './item-detail-drawer';
import { cn } from '@/lib/utils';

type Item = {
  id: string;
  itemNumber: string;
  title: string;
  totalQuantity: number;
  claimedCount: number;
  status: string;
};

type ItemsPanelProps = {
  items: Item[];
  showId: string;
  onRefresh: () => void;
};

export function ItemsPanel({ items, showId, onRefresh }: ItemsPanelProps) {
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);

  return (
    <>
      <div className="p-3 border-b bg-gray-50">
        <h3 className="font-semibold text-sm text-gray-700">Items ({items.length})</h3>
      </div>
      <div className="divide-y">
        {items.map((item) => {
          const available = item.totalQuantity - item.claimedCount;
          return (
            <button
              key={item.id}
              onClick={() => setSelectedItem(item)}
              className={cn(
                'w-full text-left px-3 py-2.5 hover:bg-gray-50 transition-colors',
                selectedItem?.id === item.id && 'bg-brand-50',
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-gray-500">
                    #{item.itemNumber}
                  </span>
                  <span className="text-sm font-medium truncate max-w-[140px]">
                    {item.title}
                  </span>
                </div>
                <Badge
                  variant={
                    item.status === 'sold_out' ? 'destructive' :
                    item.status === 'partial' ? 'warning' :
                    'outline'
                  }
                  className="text-[10px] px-1.5"
                >
                  {available}/{item.totalQuantity}
                </Badge>
              </div>
            </button>
          );
        })}
      </div>
      {selectedItem && (
        <ItemDetailDrawer
          item={selectedItem}
          showId={showId}
          onClose={() => setSelectedItem(null)}
          onRefresh={onRefresh}
        />
      )}
    </>
  );
}
