import { EventEmitter } from 'events';
import type { RealtimeEvent } from './events';

// Persist across Next.js HMR reloads in dev
const g = globalThis as unknown as {
  __realtimeEmitter?: EventEmitter;
};

function getEmitter(): EventEmitter {
  if (!g.__realtimeEmitter) {
    g.__realtimeEmitter = new EventEmitter();
    g.__realtimeEmitter.setMaxListeners(100);
  }
  return g.__realtimeEmitter;
}

/**
 * Broadcast an event to all SSE clients subscribed to a show.
 * This is the only function callers need — same API as before.
 */
export function broadcastToShow(showId: string, event: RealtimeEvent) {
  const emitter = getEmitter();
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
  const emitter = getEmitter();
  const channel = `show:${showId}`;
  emitter.on(channel, listener);
  console.log(`[SSE] Client subscribed to show ${showId.slice(0, 8)}... (${emitter.listenerCount(channel)} total)`);
  return () => {
    emitter.off(channel, listener);
    console.log(`[SSE] Client unsubscribed from show ${showId.slice(0, 8)}... (${emitter.listenerCount(channel)} remaining)`);
  };
}

/**
 * Get count of connected SSE clients for a show.
 */
export function getShowConnectionCount(showId: string): number {
  return getEmitter().listenerCount(`show:${showId}`);
}
