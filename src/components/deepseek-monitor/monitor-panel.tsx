/**
 * Monitor panel component for displaying DeepSeek events
 */

import React from 'react';
import type { DeepSeekCallEvent } from '@/lib/deepseek/monitor-types';
import { ConnectionStatus } from './connection-status';
import { EventLog } from './event-log';

export interface MonitorPanelProps {
  isOpen: boolean;
  events: DeepSeekCallEvent[];
  isConnected: boolean;
  error: string | null;
  onTest: () => void;
  onClear: () => void;
  isTesting?: boolean;
}

export function MonitorPanel({
  isOpen,
  events,
  isConnected,
  error,
  onTest,
  onClear,
  isTesting = false,
}: MonitorPanelProps) {
  if (!isOpen) {
    return null;
  }

  const lastUpdate = events.length > 0 ? events[events.length - 1].timestamp : undefined;

  return (
    <div className="fixed bottom-24 right-6 w-[480px] h-[900px] bg-gray-900 rounded-lg shadow-2xl border border-gray-700 flex flex-col z-50">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700 flex-shrink-0">
        <div>
          <h2 className="text-lg font-semibold text-white">DeepSeek Monitor</h2>
          <ConnectionStatus
            isConnected={isConnected}
            error={error}
            eventCount={events.length}
            lastUpdate={lastUpdate}
          />
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          <button
            onClick={onTest}
            disabled={isTesting}
            className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white rounded transition-colors"
          >
            {isTesting ? 'Testing...' : 'Test'}
          </button>
          <button
            onClick={onClear}
            className="px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Event log */}
      <div className="flex-1 overflow-y-auto p-4 min-h-0">
        <EventLog events={events} />
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-gray-700 text-xs text-gray-500 text-center flex-shrink-0">
        Real-time monitoring of DeepSeek LangChain calls
      </div>
    </div>
  );
}
