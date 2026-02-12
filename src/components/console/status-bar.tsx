'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { apiFetch } from '@/lib/api-client';
import { ArrowLeft, Pause, Play, Square, Wifi, WifiOff } from 'lucide-react';

type StatusBarProps = {
  showName: string;
  status: string;
  startedAt: string | null;
  totalItems: number;
  claimedItems: number;
  uniqueBuyers: number;
  connected: boolean;
  showId: string;
};

export function StatusBar({
  showName,
  status,
  startedAt,
  totalItems,
  claimedItems,
  uniqueBuyers,
  connected,
  showId,
}: StatusBarProps) {
  const [elapsed, setElapsed] = useState('00:00:00');

  useEffect(() => {
    if (!startedAt || status !== 'active') return;

    const start = new Date(startedAt).getTime();
    const interval = setInterval(() => {
      const diff = Date.now() - start;
      const hours = Math.floor(diff / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      setElapsed(
        `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`,
      );
    }, 1000);

    return () => clearInterval(interval);
  }, [startedAt, status]);

  async function lifecycleAction(action: string) {
    await apiFetch(`/api/shows/${showId}/${action}`, { method: 'POST' });
  }

  return (
    <div className="h-14 border-b bg-white flex items-center justify-between px-4">
      <div className="flex items-center gap-4">
        <Link href={`/shows/${showId}`} className="text-gray-400 hover:text-gray-600 transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h2 className="font-semibold text-gray-900">{showName}</h2>
        <div className="flex items-center gap-1.5">
          {status === 'active' && (
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
            </span>
          )}
          <Badge
            variant={
              status === 'active' ? 'success' :
              status === 'paused' ? 'warning' :
              'secondary'
            }
          >
            {status}
          </Badge>
        </div>
        <span className="font-mono text-sm text-gray-500">{elapsed}</span>
        <div className="flex items-center gap-1 text-sm">
          {connected ? (
            <Wifi className="h-3.5 w-3.5 text-green-500" />
          ) : (
            <WifiOff className="h-3.5 w-3.5 text-red-500" />
          )}
        </div>
      </div>

      <div className="flex items-center gap-6">
        <div className="flex items-center gap-4 text-sm">
          <div>
            <span className="font-semibold">{claimedItems}</span>
            <span className="text-gray-400">/{totalItems} items</span>
          </div>
          <div>
            <span className="font-semibold">{uniqueBuyers}</span>
            <span className="text-gray-400"> buyers</span>
          </div>
        </div>

        <div className="flex gap-2">
          {status === 'active' && (
            <>
              <Button size="sm" variant="outline" onClick={() => lifecycleAction('pause')}>
                <Pause className="h-3.5 w-3.5" />
              </Button>
              <Button size="sm" variant="destructive" onClick={() => lifecycleAction('stop')}>
                <Square className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
          {status === 'paused' && (
            <Button size="sm" onClick={() => lifecycleAction('activate')}>
              <Play className="h-3.5 w-3.5 mr-1" /> Resume
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
