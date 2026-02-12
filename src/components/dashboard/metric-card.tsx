'use client';

import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';

type MetricCardProps = {
  icon: React.ReactNode;
  value: string;
  label: string;
  subtitle: string;
  href: string;
  color: 'green' | 'amber' | 'blue';
};

const colorMap = {
  green: { text: 'text-green-700', bg: 'bg-green-50', icon: 'text-green-600' },
  amber: { text: 'text-amber-700', bg: 'bg-amber-50', icon: 'text-amber-600' },
  blue: { text: 'text-blue-700', bg: 'bg-blue-50', icon: 'text-blue-600' },
};

export function MetricCard({ icon, value, label, subtitle, href, color }: MetricCardProps) {
  const c = colorMap[color];
  return (
    <Link href={href}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer">
        <CardContent className="pt-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">{label}</p>
              <p className={`text-2xl font-bold mt-1 ${c.text}`}>{value}</p>
              <p className="text-xs text-gray-400 mt-1">{subtitle}</p>
            </div>
            <div className={`p-2 rounded-lg ${c.bg}`}>
              <div className={c.icon}>{icon}</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
