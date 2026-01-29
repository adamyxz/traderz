/**
 * React hook for monitoring DeepSeek events via SSE
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { DeepSeekCallEvent } from '@/lib/deepseek/monitor-types';

export interface UseDeepSeekEventsResult {
  events: DeepSeekCallEvent[];
  isConnected: boolean;
  error: string | null;
  clearEvents: () => void;
  retryCount: number;
}

const MAX_EVENTS = 100;

export function useDeepSeekEvents(autoConnect = true): UseDeepSeekEventsResult {
  const [events, setEvents] = useState<DeepSeekCallEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const clearEvents = useCallback(() => {
    setEvents([]);
  }, []);

  // Use ref to store the connect function to avoid referencing it before declaration
  const connectRef = useRef<(() => void) | null>(null);

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (heartbeatTimeoutRef.current) {
      clearTimeout(heartbeatTimeoutRef.current);
    }
    setIsConnected(false);
  }, []);

  const connect = useCallback(() => {
    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    // Clear existing timeouts
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (heartbeatTimeoutRef.current) {
      clearTimeout(heartbeatTimeoutRef.current);
    }

    try {
      const eventSource = new EventSource('/api/deepseek/events');
      eventSourceRef.current = eventSource;

      // Handle connection open
      eventSource.onopen = () => {
        setIsConnected(true);
        setError(null);
        setRetryCount((prev) => prev + 1);
      };

      // Handle connection error
      eventSource.onerror = (err) => {
        console.error('SSE connection error:', err);
        setIsConnected(false);
        setError('Connection error. Retrying...');

        // Attempt to reconnect after 3 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          connectRef.current?.();
        }, 3000);
      };

      // Handle connected event
      eventSource.addEventListener('connected', () => {
        setIsConnected(true);
        setError(null);
      });

      // Handle heartbeat
      eventSource.addEventListener('heartbeat', () => {
        // Reset heartbeat timeout
        if (heartbeatTimeoutRef.current) {
          clearTimeout(heartbeatTimeoutRef.current);
        }

        // If no heartbeat for 35 seconds, consider connection dead
        heartbeatTimeoutRef.current = setTimeout(() => {
          setIsConnected(false);
          setError('Connection timeout. Reconnecting...');
          connectRef.current?.();
        }, 35000);
      });

      // Handle history events (initial buffer)
      eventSource.addEventListener('call.history', (e) => {
        try {
          const event: DeepSeekCallEvent = JSON.parse(e.data);
          setEvents((prev) => {
            // Avoid duplicates
            if (prev.some((ev) => ev.eventId === event.eventId)) {
              return prev;
            }
            return [...prev, event].slice(-MAX_EVENTS);
          });
        } catch (err) {
          console.error('Failed to parse history event:', err);
        }
      });

      // Handle call started
      eventSource.addEventListener('call.started', (e) => {
        try {
          const event: DeepSeekCallEvent = JSON.parse(e.data);
          setEvents((prev) => {
            // Check if event already exists
            const index = prev.findIndex((ev) => ev.eventId === event.eventId);
            if (index >= 0) {
              // Update existing event
              const updated = [...prev];
              updated[index] = event;
              return updated;
            }
            // Add new event
            return [...prev, event].slice(-MAX_EVENTS);
          });
        } catch (err) {
          console.error('Failed to parse started event:', err);
        }
      });

      // Handle streaming chunks
      eventSource.addEventListener('call.chunk', (e) => {
        try {
          const event: DeepSeekCallEvent = JSON.parse(e.data);

          console.log('[Hook] Received chunk:', {
            eventId: event.eventId,
            contentLength: event.content?.length || 0,
            contentPreview: event.content?.substring(0, 50),
            hasUserPrompt: !!event.userPrompt,
          });

          setEvents((prev) => {
            const index = prev.findIndex((ev) => ev.eventId === event.eventId);

            console.log('[Hook] Current events:', prev.length, 'Index:', index);

            if (index >= 0) {
              // Update existing event, accumulate content and preserve context
              const updated = [...prev];
              const existingContent = updated[index].content || '';

              console.log('[Hook] Updating event:', {
                existingLength: existingContent.length,
                newChunkLength: event.content?.length || 0,
                totalLength: existingContent.length + (event.content?.length || 0),
              });

              updated[index] = {
                ...updated[index], // Keep all existing fields
                ...event, // Merge with new event data (has full context)
                content: existingContent + event.content, // Accumulate content
                status: 'streaming',
              };
              return updated;
            }
            // Add new event if doesn't exist (shouldn't happen in normal flow)
            console.log('[Hook] Adding new chunk event');
            return [...prev, event].slice(-MAX_EVENTS);
          });
        } catch (err) {
          console.error('Failed to parse chunk event:', err);
        }
      });

      // Handle call completed
      eventSource.addEventListener('call.completed', (e) => {
        try {
          const event: DeepSeekCallEvent = JSON.parse(e.data);
          setEvents((prev) => {
            const index = prev.findIndex((ev) => ev.eventId === event.eventId);
            if (index >= 0) {
              // Update existing event
              const updated = [...prev];
              updated[index] = {
                ...updated[index],
                ...event, // Merge all fields including content
                status: 'completed',
              };
              return updated;
            }
            // Add new event (shouldn't happen, but handle it)
            return [...prev, event].slice(-MAX_EVENTS);
          });
        } catch (err) {
          console.error('Failed to parse completed event:', err);
        }
      });

      // Handle call error
      eventSource.addEventListener('call.error', (e) => {
        try {
          const event: DeepSeekCallEvent = JSON.parse(e.data);
          setEvents((prev) => {
            const index = prev.findIndex((ev) => ev.eventId === event.eventId);
            if (index >= 0) {
              // Update existing event
              const updated = [...prev];
              updated[index] = {
                ...updated[index],
                status: 'error',
                error: event.error,
              };
              return updated;
            }
            // Add new event (shouldn't happen, but handle it)
            return [...prev, event].slice(-MAX_EVENTS);
          });
        } catch (err) {
          console.error('Failed to parse error event:', err);
        }
      });
    } catch (err) {
      console.error('Failed to create EventSource:', err);
      setError('Failed to establish connection');

      // Retry after 5 seconds
      reconnectTimeoutRef.current = setTimeout(() => {
        connectRef.current?.();
      }, 5000);
    }
  }, []);

  // Store connect in ref using effect
  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  // Auto-connect on mount if enabled
  // Note: We intentionally call setState in this effect for initialization
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, connect, disconnect]);
  /* eslint-enable react-hooks/set-state-in-effect */

  return {
    events,
    isConnected,
    error,
    clearEvents,
    retryCount,
  };
}
