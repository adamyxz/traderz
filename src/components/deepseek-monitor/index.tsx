/**
 * Main DeepSeek monitor component
 * Combines bubble button and monitor panel
 */

'use client';

import React, { useState, useMemo } from 'react';
import { MonitorBubble } from './monitor-bubble';
import { MonitorPanel } from './monitor-panel';
import { useDeepSeekEvents } from '@/hooks/use-deepseek-events';
import { useDeepSeekTest } from '@/hooks/use-deepseek-test';

export function DeepSeekMonitor() {
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [lastSeenEventCount, setLastSeenEventCount] = useState(0);

  const { events, isConnected, error, clearEvents } = useDeepSeekEvents();
  const { testConnection, isTesting } = useDeepSeekTest();

  // Track if there are active streaming events
  const hasActiveStreams = events.some((e) => e.status === 'streaming');

  // Derive hasUnreadEvents from current state
  const hasUnreadEvents = useMemo(() => {
    return !isPanelOpen && events.length > lastSeenEventCount;
  }, [isPanelOpen, events.length, lastSeenEventCount]);

  const handleTogglePanel = () => {
    setIsPanelOpen((prev) => {
      if (!prev) {
        // Panel is opening, mark events as seen
        setLastSeenEventCount(events.length);
      }
      return !prev;
    });
  };

  const handleTest = async () => {
    await testConnection();
  };

  const handleClear = () => {
    clearEvents();
    setLastSeenEventCount(0);
  };

  return (
    <>
      <MonitorBubble
        isPanelOpen={isPanelOpen}
        eventCount={hasUnreadEvents ? events.length - lastSeenEventCount : 0}
        isActive={hasActiveStreams}
        onClick={handleTogglePanel}
      />

      <MonitorPanel
        isOpen={isPanelOpen}
        events={events}
        isConnected={isConnected}
        error={error}
        onTest={handleTest}
        onClear={handleClear}
        isTesting={isTesting}
      />
    </>
  );
}
