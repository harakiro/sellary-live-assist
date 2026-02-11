'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { getAccessToken, tryRefresh } from '@/lib/api-client';
import type { RealtimeEvent } from '@/lib/realtime/events';

type UseRealtimeOptions = {
  showId: string;
  onEvent?: (event: RealtimeEvent) => void;
  enabled?: boolean;
};

const MAX_RECONNECT_DELAY = 30_000;

/**
 * SSE-based real-time event hook. Connects to the same-origin streaming
 * endpoint — no separate port, no WebSocket, works everywhere.
 *
 * Handles token expiration by refreshing the JWT before reconnecting.
 * EventSource auto-reconnect is NOT used because it reuses the same
 * (potentially expired) token URL. Instead, we close + reconnect manually
 * with a fresh token and exponential backoff.
 */
export function useRealtime({ showId, onEvent, enabled = true }: UseRealtimeOptions) {
  const [connected, setConnected] = useState(false);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;
  const sourceRef = useRef<EventSource | null>(null);
  const reconnectRef = useRef<NodeJS.Timeout>();
  const attemptRef = useRef(0);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const connect = useCallback(async () => {
    if (!enabledRef.current || !showId) return;

    // Get a fresh token — try refresh if the current one might be stale
    let token = getAccessToken();
    if (!token) {
      const refreshed = await tryRefresh();
      if (refreshed) {
        token = getAccessToken();
      }
    }
    if (!token) {
      console.warn('[Realtime] No access token available');
      return;
    }

    // Close any existing connection
    if (sourceRef.current) {
      sourceRef.current.close();
      sourceRef.current = null;
    }

    const url = `/api/shows/${showId}/stream?token=${encodeURIComponent(token)}`;
    const source = new EventSource(url);

    source.onopen = () => {
      setConnected(true);
      attemptRef.current = 0;
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
      // Close the stale connection — don't let EventSource auto-reconnect
      // with the same (potentially expired) token
      source.close();
      sourceRef.current = null;

      if (!enabledRef.current) return;

      // Reconnect with exponential backoff and a fresh token
      const delay = Math.min(1000 * Math.pow(2, attemptRef.current), MAX_RECONNECT_DELAY);
      attemptRef.current++;
      console.warn(`[Realtime] Connection lost, reconnecting in ${delay}ms...`);
      reconnectRef.current = setTimeout(connect, delay);
    };

    sourceRef.current = source;
  }, [showId]);

  useEffect(() => {
    if (enabled) {
      connect();
    }

    return () => {
      if (reconnectRef.current) {
        clearTimeout(reconnectRef.current);
      }
      if (sourceRef.current) {
        sourceRef.current.close();
        sourceRef.current = null;
        setConnected(false);
      }
    };
  }, [connect, enabled]);

  return { connected };
}
