/**
 * TimelineVisualization Component
 * Main component integrating all timeline sub-components
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { TimelineControls } from './TimelineControls';
import { TimelineRuler } from './TimelineRuler';
import { HeartbeatNodesLayer } from './HeartbeatNodesLayer';
import { useTimelineEvents } from '@/hooks/use-timeline-events';
import type { TimelineHeartbeat } from '@/lib/timeline/types';
import { TIMELINE_RANGE_HOURS } from '@/lib/timeline/constants';

interface TimelineVisualizationProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
}

export function TimelineVisualization({ enabled, onToggle }: TimelineVisualizationProps) {
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [heartbeats, setHeartbeats] = useState<TimelineHeartbeat[]>([]);
  const [activeTraderCount, setActiveTraderCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  const hasFetchedRef = useRef(false);

  // Update current time every second for display purposes
  useEffect(() => {
    if (!enabled) {
      hasFetchedRef.current = false;
      return;
    }

    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(interval);
  }, [enabled]);

  // Fetch heartbeat data - only on mount and when enabled changes
  useEffect(() => {
    if (!enabled) {
      setHeartbeats([]);
      hasFetchedRef.current = false;
      return;
    }

    // Prevent duplicate fetches
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;

    const fetchHeartbeats = async () => {
      setIsLoading(true);
      try {
        const now = new Date();
        const rangeStart = new Date(now.getTime() + TIMELINE_RANGE_HOURS.past * 60 * 60 * 1000);
        const rangeEnd = new Date(now.getTime() + TIMELINE_RANGE_HOURS.future * 60 * 60 * 1000);

        console.log('[TimelineVisualization] Fetching heartbeats:', {
          now: now.toISOString(),
          rangeStart: rangeStart.toISOString(),
          rangeEnd: rangeEnd.toISOString(),
        });

        const response = await fetch(
          `/api/admin/timeline/heartbeats?rangeStart=${rangeStart.toISOString()}&rangeEnd=${rangeEnd.toISOString()}`
        );

        if (!response.ok) throw new Error('Failed to fetch heartbeat data');

        const data = await response.json();
        console.log('[TimelineVisualization] Received data:', data);

        if (data.success) {
          setHeartbeats(data.data.heartbeats);
          console.log(
            '[TimelineVisualization] Set heartbeats:',
            data.data.heartbeats.length,
            'items'
          );
        } else {
          console.error('[TimelineVisualization] API returned error:', data.error);
        }
      } catch (error) {
        console.error('[TimelineVisualization] Error fetching heartbeats:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchHeartbeats();

    // Refresh data every 30 seconds
    const refreshInterval = setInterval(() => {
      fetchHeartbeats();
    }, 30000);

    return () => clearInterval(refreshInterval);
  }, [enabled]);

  // Fetch initial config
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const response = await fetch('/api/admin/timeline/config');
        if (!response.ok) return;

        const data = await response.json();
        if (data.success) {
          setActiveTraderCount(data.data.activeTraderCount);
        }
      } catch (error) {
        console.error('[TimelineVisualization] Error fetching config:', error);
      }
    };

    fetchConfig();
  }, []);

  // Handle SSE events
  const handleHeartbeatUpdate = useCallback((updatedHeartbeat: TimelineHeartbeat) => {
    setHeartbeats((prev) => {
      const index = prev.findIndex((h) => h.id === updatedHeartbeat.id);
      if (index >= 0) {
        // Update existing heartbeat
        const newHeartbeats = [...prev];
        newHeartbeats[index] = updatedHeartbeat;
        return newHeartbeats;
      } else {
        // Add new heartbeat
        return [...prev, updatedHeartbeat];
      }
    });
  }, []);

  const { connected, error } = useTimelineEvents({
    enabled,
    onHeartbeatUpdate: handleHeartbeatUpdate,
  });

  // Handle toggle
  const handleToggle = useCallback(
    async (newEnabled: boolean) => {
      try {
        const response = await fetch('/api/admin/timeline/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabled: newEnabled }),
        });

        if (!response.ok) throw new Error('Failed to update timeline config');

        const data = await response.json();
        if (data.success) {
          onToggle(data.data.enabled);
          setActiveTraderCount(data.data.activeTraderCount);
          // Reset fetch flag when toggling
          hasFetchedRef.current = false;
        }
      } catch (error) {
        console.error('[TimelineVisualization] Error toggling timeline:', error);
        throw error;
      }
    },
    [onToggle]
  );

  // Don't render if not enabled (optional - remove if you want to show empty state)
  if (!enabled) {
    return (
      <TimelineControls
        enabled={enabled}
        onToggle={handleToggle}
        activeTraderCount={activeTraderCount}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <TimelineControls
        enabled={enabled}
        onToggle={handleToggle}
        activeTraderCount={activeTraderCount}
      />

      {/* Status bar */}
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-4">
          {connected ? (
            <div className="flex items-center gap-2 text-green-500">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span>Live</span>
            </div>
          ) : (
            <span className="text-gray-400">Connecting...</span>
          )}
          {error && <span className="text-red-500">{error}</span>}
          {isLoading && <span className="text-gray-400">Loading...</span>}
        </div>
        <div className="text-gray-400">
          {currentTime.toLocaleTimeString('en-US', { hour12: false })} UTC
        </div>
      </div>

      {/* Timeline ruler */}
      <TimelineRuler currentTime={currentTime} />

      {/* Heartbeat nodes */}
      <HeartbeatNodesLayer heartbeats={heartbeats} currentTime={currentTime} />
    </div>
  );
}
