/**
 * SSE endpoint for DeepSeek event streaming
 * Clients connect to this endpoint to receive real-time events
 */

import { NextRequest } from 'next/server';
import { eventBus } from '@/lib/deepseek/events';

/**
 * GET endpoint for SSE event streaming
 */
export async function GET(request: NextRequest) {
  const encoder = new TextEncoder();

  // Create a readable stream for SSE
  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection message
      const data = JSON.stringify({
        type: 'connected',
        timestamp: Date.now(),
      });
      controller.enqueue(encoder.encode(`event: connected\ndata: ${data}\n\n`));

      // Send recent events from buffer
      const recentEvents = eventBus.getRecentEvents(100);
      for (const event of recentEvents) {
        const eventData = JSON.stringify(event);
        controller.enqueue(encoder.encode(`event: call.history\ndata: ${eventData}\n\n`));
      }

      // Subscribe to new events
      const subscription = eventBus.subscribe((event) => {
        const eventData = JSON.stringify(event);

        // Determine event type based on status
        let eventType = 'call.update';
        if (event.status === 'started') {
          eventType = 'call.started';
        } else if (event.status === 'streaming') {
          eventType = 'call.chunk';
        } else if (event.status === 'completed') {
          eventType = 'call.completed';
        } else if (event.status === 'error') {
          eventType = 'call.error';
        }

        // Debug logging
        console.log('[SSE] Sending event:', {
          eventType,
          eventId: event.eventId,
          status: event.status,
          contentLength: event.content?.length || 0,
        });

        controller.enqueue(encoder.encode(`event: ${eventType}\ndata: ${eventData}\n\n`));
      });

      // Set up heartbeat interval (every 30 seconds)
      const heartbeatInterval = setInterval(() => {
        const heartbeat = JSON.stringify({
          type: 'heartbeat',
          timestamp: Date.now(),
        });
        controller.enqueue(encoder.encode(`event: heartbeat\ndata: ${heartbeat}\n\n`));
      }, 30000);

      // Clean up on connection close
      request.signal.addEventListener('abort', () => {
        clearInterval(heartbeatInterval);
        subscription.unsubscribe();
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable Nginx buffering
    },
  });
}
