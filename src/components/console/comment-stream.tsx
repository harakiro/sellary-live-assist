'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type CommentEntry = {
  id: string;
  userHandle: string;
  text: string;
  parsed: boolean;
  timestamp: string;
};

type CommentStreamProps = {
  entries: CommentEntry[];
};

export function CommentStream({ entries }: CommentStreamProps) {
  const [search, setSearch] = useState('');

  const filtered = search
    ? entries.filter(
        (e) =>
          e.userHandle?.toLowerCase().includes(search.toLowerCase()) ||
          e.text.toLowerCase().includes(search.toLowerCase()),
      )
    : entries;

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b bg-gray-50 flex items-center gap-3">
        <h3 className="font-semibold text-sm text-gray-700 whitespace-nowrap">
          Comments ({entries.length})
        </h3>
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search..."
          className="h-7 text-xs"
        />
      </div>
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="text-center py-8 text-sm text-gray-400">
            {entries.length === 0 ? 'No comments yet' : 'No matches'}
          </div>
        ) : (
          <div className="divide-y">
            {filtered.map((entry) => (
              <div
                key={entry.id}
                className={cn(
                  'px-3 py-2',
                  entry.parsed && 'bg-yellow-50/50',
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-400 font-mono">
                    {new Date(entry.timestamp).toLocaleTimeString()}
                  </span>
                  <span className="text-xs font-semibold text-gray-600">
                    @{entry.userHandle || 'unknown'}
                  </span>
                </div>
                <p className={cn('text-sm mt-0.5', entry.parsed && 'font-medium text-brand-700')}>
                  {entry.text}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
