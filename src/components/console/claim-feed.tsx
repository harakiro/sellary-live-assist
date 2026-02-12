'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type ClaimEntry = {
  id: string;
  itemNumber: string;
  userHandle: string;
  claimStatus: string;
  waitlistPosition?: number;
  timestamp: string;
};

type ClaimFeedProps = {
  entries: ClaimEntry[];
  onCreateItem?: (itemNumber: string) => void;
};

const statusConfig: Record<string, { variant: 'success' | 'default' | 'secondary' | 'outline' | 'warning'; label: string }> = {
  winner: { variant: 'success', label: 'Winner' },
  waitlist: { variant: 'default', label: 'Waitlist' },
  released: { variant: 'secondary', label: 'Released' },
  passed: { variant: 'secondary', label: 'Passed' },
  duplicate: { variant: 'outline', label: 'Duplicate' },
  duplicate_user: { variant: 'outline', label: 'Duplicate' },
  unmatched: { variant: 'warning', label: 'Unmatched' },
};

export function ClaimFeed({ entries, onCreateItem }: ClaimFeedProps) {
  const [search, setSearch] = useState('');

  const filtered = search
    ? entries.filter(
        (e) =>
          e.userHandle?.toLowerCase().includes(search.toLowerCase()) ||
          e.itemNumber.includes(search),
      )
    : entries;

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b bg-gray-50 flex items-center gap-3">
        <h3 className="font-semibold text-sm text-gray-700 whitespace-nowrap">
          Claim Feed ({entries.length})
        </h3>
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by user or item..."
          className="h-7 text-xs"
        />
      </div>
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="text-center py-8 text-sm text-gray-400">
            {entries.length === 0 ? 'No claims yet' : 'No matches'}
          </div>
        ) : (
          <div className="divide-y">
            {filtered.map((entry) => {
              const config = statusConfig[entry.claimStatus] || statusConfig.winner;
              return (
                <div
                  key={entry.id}
                  className={cn(
                    'px-4 py-2.5 flex items-center justify-between',
                    entry.claimStatus === 'winner' && 'bg-green-50/50',
                    entry.claimStatus === 'waitlist' && 'bg-blue-50/50',
                    entry.claimStatus === 'unmatched' && 'bg-amber-50/50',
                  )}
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs text-gray-400 w-16">
                      {new Date(entry.timestamp).toLocaleTimeString()}
                    </span>
                    <span className="text-sm font-medium">@{entry.userHandle || 'unknown'}</span>
                    <span className="font-mono text-xs text-gray-500">#{entry.itemNumber}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {entry.claimStatus === 'unmatched' && onCreateItem && (
                      <button
                        type="button"
                        onClick={() => onCreateItem(entry.itemNumber)}
                        className="text-[10px] text-amber-700 hover:text-amber-900 font-medium underline underline-offset-2"
                      >
                        Create Item
                      </button>
                    )}
                    <Badge variant={config.variant} className="text-[10px]">
                      {config.label}
                      {entry.claimStatus === 'waitlist' && entry.waitlistPosition
                        ? ` #${entry.waitlistPosition}`
                        : ''}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
