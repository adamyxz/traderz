/**
 * Timeline SSE Events API
 * GET /api/admin/timeline/events - Server-Sent Events stream
 */

import { NextRequest } from 'next/server';
import { getTimelineScheduler } from '@/lib/timeline/scheduler';
import type { TimelineEvent } from '@/lib/timeline/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const scheduler = getTimelineScheduler();

  // Create a readable stream for SSE
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection message
      const data = `data: ${JSON.stringify({ type: 'connected', timestamp: new Date().toISOString() })}\n\n`;
      controller.enqueue(encoder.encode(data));

      // Add event listener
      const listener = (event: TimelineEvent) => {
        const eventData = `data: ${JSON.stringify(event)}\n\n`;
        try {
          controller.enqueue(encoder.encode(eventData));
        } catch (error) {
          console.error('[TimelineEventsAPI] Error sending event:', error);
        }
      };

      scheduler.addEventListener(listener);

      // Send keepalive comments every 15 seconds to prevent timeout
      const keepAliveInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': keepalive\n\n'));
        } catch (error) {
          console.error('[TimelineEventsAPI] Error sending keepalive:', error);
        }
      }, 15000);

      // Cleanup on connection close
      request.signal.addEventListener('abort', () => {
        clearInterval(keepAliveInterval);
        scheduler.removeEventListener(listener);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    },
  });
}
