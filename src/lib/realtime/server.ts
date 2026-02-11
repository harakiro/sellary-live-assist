import { EventEmitter } from 'events';
import type { RealtimeEvent } from './events';

// Persist across Next.js HMR reloads in dev
const g = globalThis as unknown as {
  __realtimeEmitter?: EventEmitter;
};

if (!g.__realtimeEmitter) {
  g.__realtimeEmitter = new EventEmitter();
  g.__realtimeEmitter.setMaxListeners(100);
}

const emitter = g.__realtimeEmitter;

/**
 * Broadcast an event to all SSE clients subscribed to a show.
 * This is the only function callers need — same API as before.
 */
export function broadcastToShow(showId: string, event: RealtimeEvent) {
  const channel = `show:${showId}`;
  const count = emitter.listenerCount(channel);
  emitter.emit(channel, event);
  console.log(`[SSE] Broadcast ${event.type} to ${count} clients for show ${showId.slice(0, 8)}...`);
}

/**
 * Subscribe to real-time events for a show. Returns an unsubscribe function.
 * Used by the SSE streaming endpoint.
 */
export function subscribeToShow(
  showId: string,
  listener: (event: RealtimeEvent) => void,
): () => void {
  const channel = `show:${showId}`;
  emitter.on(channel, listener);
  return () => {
    emitter.off(channel, listener);
  };
}

/**
 * Get count of connected SSE clients for a show.
 */
export function getShowConnectionCount(showId: string): number {
  return emitter.listenerCount(`show:${showId}`);
}
