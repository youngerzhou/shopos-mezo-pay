
import { NextRequest } from 'next/server';
import { getOrder } from '@/app/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const orderId = searchParams.get('orderId');

  if (!orderId) {
    return new Response('Missing orderId', { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const interval = setInterval(async () => {
        try {
          // Send a heartbeat comment to keep connection alive
          controller.enqueue(encoder.encode(': heartbeat\n\n'));
          
          const order = await getOrder(orderId);
          if (order) {
            const data = JSON.stringify({
              ...order,
              _server_time: new Date().toISOString()
            });
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));

            if (order.status === 'paid' || order.status === 'success' || order.status === 'failed') {
              clearInterval(interval);
              controller.close();
            }
          }
        } catch (err) {
          console.error('[SSE] Poll Error:', err);
        }
      }, 1500); // Check SQLite every 1.5s

      req.signal.addEventListener('abort', () => {
        clearInterval(interval);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Content-Type-Options': 'nosniff',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
