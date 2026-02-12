'use client';

import { cn } from '@/lib/utils';

type CartFiltersProps = {
  counts: { all: number; sent: number; paid: number; void: number; error: number };
  activeStatus: string;
  sort: string;
  onStatusChange: (status: string) => void;
  onSortChange: (sort: string) => void;
};

const tabs = [
  { key: '', label: 'All', countKey: 'all' as const },
  { key: 'pending', label: 'Pending', countKey: 'sent' as const },
  { key: 'paid', label: 'Paid', countKey: 'paid' as const },
  { key: 'void', label: 'Expired', countKey: 'void' as const },
  { key: 'error', label: 'Error', countKey: 'error' as const },
];

const sortOptions = [
  { value: 'newest', label: 'Newest First' },
  { value: 'oldest', label: 'Oldest First' },
  { value: 'amount_desc', label: 'Amount: High to Low' },
  { value: 'amount_asc', label: 'Amount: Low to High' },
];

export function CartFilters({ counts, activeStatus, sort, onStatusChange, onSortChange }: CartFiltersProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => onStatusChange(tab.key)}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
              activeStatus === tab.key
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
            )}
          >
            {tab.label}
            <span
              className={cn(
                'text-xs px-1.5 py-0.5 rounded-full min-w-[20px] text-center',
                activeStatus === tab.key
                  ? 'bg-gray-700 text-gray-200'
                  : 'bg-gray-200 text-gray-500',
              )}
            >
              {counts[tab.countKey]}
            </span>
          </button>
        ))}
      </div>
      <select
        value={sort}
        onChange={(e) => onSortChange(e.target.value)}
        className="text-sm border border-gray-300 rounded-md px-3 py-1.5 bg-white text-gray-700"
      >
        {sortOptions.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}
