'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Send } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';

type ResendAllDialogProps = {
  pendingCount: number;
  onComplete: () => void;
};

export function ResendAllDialog({ pendingCount, onComplete }: ResendAllDialogProps) {
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ sent: number; failed: number; total: number } | null>(null);

  async function handleResend() {
    setSending(true);
    setResult(null);

    const res = await apiFetch<{ total: number; sent: number; failed: number }>(
      '/api/carts/resend-all',
      { method: 'POST' },
    );

    if ('data' in res) {
      setResult(res.data);
    } else {
      setResult({ total: 0, sent: 0, failed: 0 });
    }

    setSending(false);
    onComplete();
  }

  if (!open) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        disabled={pendingCount === 0}
      >
        <Send className="h-3.5 w-3.5 mr-1.5" />
        Resend All Pending
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-lg p-6 max-w-sm w-full mx-4">
        {result ? (
          <>
            <h3 className="text-lg font-semibold mb-2">Done</h3>
            <p className="text-sm text-gray-600 mb-4">
              Sent {result.sent} of {result.total}.
              {result.failed > 0 && ` ${result.failed} failed.`}
            </p>
            <Button onClick={() => { setOpen(false); setResult(null); }} className="w-full">
              Close
            </Button>
          </>
        ) : (
          <>
            <h3 className="text-lg font-semibold mb-2">Resend All Pending</h3>
            <p className="text-sm text-gray-600 mb-4">
              Send checkout links to all {pendingCount} buyer{pendingCount !== 1 ? 's' : ''} with pending carts?
            </p>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setOpen(false)} disabled={sending} className="flex-1">
                Cancel
              </Button>
              <Button onClick={handleResend} disabled={sending} className="flex-1">
                {sending ? 'Sending...' : 'Send All'}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
