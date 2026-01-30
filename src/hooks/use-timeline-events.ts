/**
 * useTimelineEvents Hook
 * Manages SSE connection to timeline events
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import type { TimelineEvent, TimelineHeartbeat } from '@/lib/timeline/types';

interface UseTimelineEventsOptions {
  enabled: boolean;
  onHeartbeatUpdate?: (heartbeat: TimelineHeartbeat) => void;
  onTimelineStateChange?: (enabled: boolean) => void;
}

interface UseTimelineEventsReturn {
  connected: boolean;
  lastEvent: TimelineEvent | null;
  error: string | null;
}

/**
 * Hook for managing SSE connection to timeline events
 */
export function useTimelineEvents({
  enabled,
  onHeartbeatUpdate,
  onTimelineStateChange,
}: UseTimelineEventsOptions): UseTimelineEventsReturn {
  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<TimelineEvent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const connect = useCallback(() => {
    if (!enabled || eventSourceRef.current) {
      return;
    }

    const eventSource = new EventSource('/api/admin/timeline/events');
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setConnected(true);
      setError(null);
      console.log('[useTimelineEvents] Connected');
    };

    eventSource.onerror = (err) => {
      console.error('[useTimelineEvents] Connection error:', err);
      setError('Connection error');
      setConnected(false);
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as TimelineEvent;
        setLastEvent(data);

        // Handle specific event types with proper type narrowing
        if (data.type.startsWith('heartbeat.')) {
          if ('heartbeat' in data.data) {
            onHeartbeatUpdate?.(data.data.heartbeat);
          }
        } else if (data.type === 'timeline.enabled' || data.type === 'timeline.disabled') {
          if ('enabled' in data.data) {
            onTimelineStateChange?.(data.data.enabled);
          }
        }
      } catch (err) {
        console.error('[useTimelineEvents] Error parsing event:', err);
      }
    };

    return () => {
      eventSource.close();
      eventSourceRef.current = null;
      setConnected(false);
    };
  }, [enabled, onHeartbeatUpdate, onTimelineStateChange]);

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
      setConnected(false);
    }
  }, []);

  // Connect/disconnect based on enabled state
  useEffect(() => {
    if (!enabled) {
      // When disabled, use setTimeout to defer disconnect
      const timeoutId = setTimeout(() => {
        disconnect();
      }, 0);
      return () => clearTimeout(timeoutId);
    }

    const cleanup = connect();
    return cleanup;
  }, [enabled, connect, disconnect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    connected,
    lastEvent,
    error,
  };
}
