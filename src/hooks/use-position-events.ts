/**
 * usePositionEvents Hook
 * Manages SSE connection to position change events
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import type { PositionEvent } from '@/lib/trading/position-events';

interface UsePositionEventsOptions {
  enabled: boolean;
  onPositionChange?: (event: PositionEvent) => void;
}

interface UsePositionEventsReturn {
  connected: boolean;
  lastEvent: PositionEvent | null;
  error: string | null;
}

/**
 * Hook for managing SSE connection to position change events
 */
export function usePositionEvents({
  enabled,
  onPositionChange,
}: UsePositionEventsOptions): UsePositionEventsReturn {
  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<PositionEvent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const connect = useCallback(() => {
    if (!enabled || eventSourceRef.current) {
      return;
    }

    const eventSource = new EventSource('/api/trading/position-events');
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setConnected(true);
      setError(null);
      console.log('[usePositionEvents] Connected');
    };

    eventSource.onerror = (err) => {
      console.error('[usePositionEvents] Connection error:', err);
      setError('Connection error');
      setConnected(false);
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        // Skip initial connection message
        if (data.type === 'connected') {
          return;
        }

        const positionEvent = data as PositionEvent;
        setLastEvent(positionEvent);

        // Call the callback with the event
        onPositionChange?.(positionEvent);
      } catch (err) {
        console.error('[usePositionEvents] Error parsing event:', err);
      }
    };

    return () => {
      eventSource.close();
      eventSourceRef.current = null;
      setConnected(false);
    };
  }, [enabled, onPositionChange]);

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
