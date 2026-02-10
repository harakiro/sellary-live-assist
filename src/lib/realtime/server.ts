import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import { verifyAccessToken } from '@/lib/auth/jwt';
import type { RealtimeEvent } from './events';

type ClientConnection = {
  ws: WebSocket;
  showId: string;
  userId: string;
};

const clients = new Map<WebSocket, ClientConnection>();
const HEARTBEAT_INTERVAL = 30000;

let wss: WebSocketServer | null = null;
let heartbeatTimer: NodeJS.Timeout | null = null;

export function initWebSocketServer(server: Server): WebSocketServer {
  if (wss) return wss;

  wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', async (request, socket, head) => {
    const url = new URL(request.url || '', `http://${request.headers.host}`);

    if (url.pathname !== '/api/realtime') {
      socket.destroy();
      return;
    }

    const token = url.searchParams.get('token');
    const showId = url.searchParams.get('show_id');

    if (!token || !showId) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    try {
      const payload = await verifyAccessToken(token);
      wss!.handleUpgrade(request, socket, head, (ws) => {
        const conn: ClientConnection = { ws, showId, userId: payload.userId };
        clients.set(ws, conn);

        ws.on('close', () => {
          clients.delete(ws);
        });

        ws.on('pong', () => {
          // Client is alive
        });

        // Send connection confirmation
        ws.send(JSON.stringify({
          type: 'session.status',
          data: { showId, status: 'connected', timestamp: new Date().toISOString() },
        }));
      });
    } catch {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
    }
  });

  // Heartbeat
  heartbeatTimer = setInterval(() => {
    clients.forEach((conn) => {
      if (conn.ws.readyState === WebSocket.OPEN) {
        conn.ws.ping();
      }
    });
  }, HEARTBEAT_INTERVAL);

  return wss;
}

/**
 * Broadcast an event to all clients connected to a specific show.
 */
export function broadcastToShow(showId: string, event: RealtimeEvent) {
  const message = JSON.stringify(event);
  clients.forEach((conn) => {
    if (conn.showId === showId && conn.ws.readyState === WebSocket.OPEN) {
      conn.ws.send(message);
    }
  });
}

/**
 * Get count of connected clients for a show.
 */
export function getShowConnectionCount(showId: string): number {
  let count = 0;
  clients.forEach((conn) => {
    if (conn.showId === showId && conn.ws.readyState === WebSocket.OPEN) {
      count++;
    }
  });
  return count;
}

export function shutdownWebSocket() {
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  clients.forEach((conn) => conn.ws.close());
  clients.clear();
  if (wss) {
    wss.close();
    wss = null;
  }
}
