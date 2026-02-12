'use client';

import { useState, useEffect, type FormEvent } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ItemDetailDrawer } from './item-detail-drawer';
import { apiFetch } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { Plus, ChevronDown, ChevronUp } from 'lucide-react';

type Item = {
  id: string;
  itemNumber: string;
  title: string;
  totalQuantity: number;
  claimedCount: number;
  price: number | null;
  status: string;
};

type ItemsPanelProps = {
  items: Item[];
  showId: string;
  onRefresh: () => void;
  prefillItemNumber?: string | null;
  onPrefillConsumed?: () => void;
  autoNumberEnabled?: boolean;
  autoNumberStart?: number;
};

function getNextItemNumber(items: { itemNumber: string }[], startNumber: number): string {
  if (items.length === 0) return String(startNumber);
  const nums = items.map(i => parseInt(i.itemNumber, 10)).filter(n => !isNaN(n));
  return nums.length > 0 ? String(Math.max(...nums) + 1) : String(startNumber);
}

export function ItemsPanel({ items, showId, onRefresh, prefillItemNumber, onPrefillConsumed, autoNumberEnabled, autoNumberStart }: ItemsPanelProps) {
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [itemNumber, setItemNumber] = useState('');
  const [itemTitle, setItemTitle] = useState('');
  const [itemPrice, setItemPrice] = useState('');
  const [itemQty, setItemQty] = useState(1);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  useEffect(() => {
    if (prefillItemNumber) {
      setShowAddForm(true);
      setItemNumber(prefillItemNumber);
      onPrefillConsumed?.();
    }
  }, [prefillItemNumber, onPrefillConsumed]);

  // Auto-fill item number when items change and auto-number is enabled
  useEffect(() => {
    if (autoNumberEnabled && !prefillItemNumber) {
      setItemNumber(getNextItemNumber(items, autoNumberStart ?? 1));
    }
  }, [items, autoNumberEnabled, autoNumberStart, prefillItemNumber]);

  async function addItem(e: FormEvent) {
    e.preventDefault();
    setAdding(true);
    setAddError(null);
    const price = itemPrice ? Math.round(parseFloat(itemPrice) * 100) : null;
    const res = await apiFetch(`/api/shows/${showId}/items`, {
      method: 'POST',
      body: JSON.stringify({ itemNumber, title: itemTitle, totalQuantity: itemQty, price }),
    });
    setAdding(false);
    if ('error' in res) {
      setAddError(res.error.message);
      return;
    }
    setItemTitle('');
    setItemPrice('');
    setItemQty(1);
    setShowAddForm(false);
    onRefresh();
  }

  return (
    <>
      <div className="p-3 border-b bg-gray-50 flex items-center justify-between">
        <h3 className="font-semibold text-sm text-gray-700">Items ({items.length})</h3>
        <button
          type="button"
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700 font-medium"
        >
          <Plus className="h-3.5 w-3.5" />
          Add
          {showAddForm ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>
      </div>
      {showAddForm && (
        <form onSubmit={addItem} className="p-3 border-b bg-gray-50/50 space-y-2">
          {addError && (
            <p className="text-xs text-red-600">{addError}</p>
          )}
          <div className="flex gap-2">
            <Input
              value={itemNumber}
              onChange={(e) => setItemNumber(e.target.value)}
              required
              placeholder="#"
              className="h-7 text-xs w-14"
            />
            <Input
              value={itemTitle}
              onChange={(e) => setItemTitle(e.target.value)}
              required
              placeholder="Item title"
              className="h-7 text-xs flex-1"
            />
            <Input
              type="number"
              min={0}
              step="0.01"
              value={itemPrice}
              onChange={(e) => setItemPrice(e.target.value)}
              placeholder="$"
              className="h-7 text-xs w-16"
            />
            <Input
              type="number"
              min={1}
              max={30}
              value={itemQty}
              onChange={(e) => setItemQty(Number(e.target.value))}
              className="h-7 text-xs w-12"
            />
          </div>
          <Button type="submit" size="sm" disabled={adding} className="w-full h-7 text-xs">
            {adding ? 'Adding...' : 'Add Item'}
          </Button>
        </form>
      )}
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
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-mono text-xs font-bold text-gray-500">
                    #{item.itemNumber}
                  </span>
                  <span className="text-sm font-medium truncate max-w-[100px]">
                    {item.title}
                  </span>
                  {item.price != null && (
                    <span className="text-[10px] text-gray-400 shrink-0">
                      ${(item.price / 100).toFixed(2)}
                    </span>
                  )}
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
