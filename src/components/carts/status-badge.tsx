'use client';

import { useState, useRef, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, ChevronDown, Loader2 } from 'lucide-react';
import { CART_STATUS_MAP } from '@/lib/utils';
import { apiFetch } from '@/lib/api-client';

type StatusBadgeProps = {
  cartId: string;
  status: string;
  onUpdate?: () => void;
};

export function StatusBadge({ cartId, status, onUpdate }: StatusBadgeProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const statusInfo = CART_STATUS_MAP[status] ?? { label: status, variant: 'secondary' as const };
  const canChange = status !== 'paid' && status !== 'void';

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  async function markPaid() {
    setLoading(true);
    const res = await apiFetch<{ id: string; status: string }>(`/api/carts/${cartId}/mark-paid`, {
      method: 'POST',
    });
    if ('data' in res && res.data.status === 'paid') {
      onUpdate?.();
    }
    setLoading(false);
    setOpen(false);
  }

  if (!canChange) {
    return <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>;
  }

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="group inline-flex items-center gap-1 rounded-full focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1"
      >
        <Badge variant={statusInfo.variant} className="cursor-pointer pr-1.5">
          {statusInfo.label}
          <ChevronDown className="h-3 w-3 ml-0.5 opacity-50 group-hover:opacity-100 transition-opacity" />
        </Badge>
      </button>

      {open && (
        <div className="absolute z-20 mt-1 left-1/2 -translate-x-1/2 bg-white rounded-lg shadow-lg border py-1 w-40 animate-in fade-in zoom-in-95 duration-100">
          <button
            onClick={markPaid}
            disabled={loading}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 text-gray-400 animate-spin" />
            ) : (
              <CheckCircle className="h-3.5 w-3.5 text-green-600" />
            )}
            Mark as Paid
          </button>
        </div>
      )}
    </div>
  );
}
