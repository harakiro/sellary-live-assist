'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { getAccessToken } from '@/lib/api-client';
import type { RealtimeEvent } from '@/lib/realtime/events';

type UseRealtimeOptions = {
  showId: string;
  onEvent?: (event: RealtimeEvent) => void;
  enabled?: boolean;
};

/**
 * SSE-based real-time event hook. Connects to the same-origin streaming
 * endpoint — no separate port, no WebSocket, works everywhere.
 */
export function useRealtime({ showId, onEvent, enabled = true }: UseRealtimeOptions) {
  const [connected, setConnected] = useState(false);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;
  const sourceRef = useRef<EventSource | null>(null);

  const connect = useCallback(() => {
    if (!enabled || !showId) return;

    const token = getAccessToken();
    if (!token) {
      console.warn('[Realtime] No access token, skipping SSE connection');
      return;
    }

    const url = `/api/shows/${showId}/stream?token=${encodeURIComponent(token)}`;
    const source = new EventSource(url);

    source.onopen = () => {
      setConnected(true);
    };

    source.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data) as RealtimeEvent;
        onEventRef.current?.(event);
      } catch {
        // Ignore malformed messages
      }
    };

    source.onerror = () => {
      setConnected(false);
      // EventSource auto-reconnects with built-in backoff
      console.warn('[Realtime] SSE connection error, auto-reconnecting...');
    };

    sourceRef.current = source;
  }, [enabled, showId]);

  useEffect(() => {
    connect();

    return () => {
      if (sourceRef.current) {
        sourceRef.current.close();
        sourceRef.current = null;
        setConnected(false);
      }
    };
  }, [connect]);

  return { connected };
}
