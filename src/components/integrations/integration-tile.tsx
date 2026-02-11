'use client';

import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Check, Lock } from 'lucide-react';

type IntegrationTileProps = {
  provider: string;
  displayName: string;
  description: string;
  connected: boolean;
  status: string;
  comingSoon?: boolean;
};

export function IntegrationTile({
  provider,
  displayName,
  description,
  connected,
  status,
  comingSoon,
}: IntegrationTileProps) {
  return (
    <Card className={comingSoon ? 'opacity-60' : ''}>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="font-semibold text-lg">{displayName}</h3>
            <p className="text-sm text-gray-500 mt-1">{description}</p>
          </div>
          {connected && (
            <Badge variant="success" className="shrink-0">
              <Check className="h-3 w-3 mr-1" /> Connected
            </Badge>
          )}
          {comingSoon && (
            <Badge variant="secondary" className="shrink-0">
              <Lock className="h-3 w-3 mr-1" /> Coming Soon
            </Badge>
          )}
        </div>
        {!comingSoon && (
          <Link href={`/integrations/${provider}`}>
            <Button size="sm" variant={connected ? 'outline' : 'default'}>
              {connected ? 'Manage' : 'Connect'}
            </Button>
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
