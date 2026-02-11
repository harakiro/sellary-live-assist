import { NextRequest } from 'next/server';
import { verifyAccessToken } from '@/lib/auth/jwt';
import { subscribeToShow } from '@/lib/realtime/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const HEARTBEAT_INTERVAL = 15_000;

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const showId = params.id;
  const token = req.nextUrl.searchParams.get('token');

  if (!token) {
    return new Response(
      JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'Missing token' } }),
      { status: 401, headers: { 'Content-Type': 'application/json' } },
    );
  }

  try {
    await verifyAccessToken(token);
  } catch {
    return new Response(
      JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'Invalid token' } }),
      { status: 401, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection event
      const connected = {
        type: 'session.status',
        data: { showId, status: 'connected', timestamp: new Date().toISOString() },
      };
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(connected)}\n\n`));

      // Subscribe to show events
      const unsubscribe = subscribeToShow(showId, (event) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          cleanup();
        }
      });

      // Heartbeat to keep connection alive
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: heartbeat\n\n`));
        } catch {
          cleanup();
        }
      }, HEARTBEAT_INTERVAL);

      function cleanup() {
        clearInterval(heartbeat);
        unsubscribe();
      }

      // Clean up when client disconnects
      req.signal.addEventListener('abort', cleanup);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
