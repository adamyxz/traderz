/**
 * Connection status component for DeepSeek monitor
 */

import React from 'react';

export interface ConnectionStatusProps {
  isConnected: boolean;
  error: string | null;
  eventCount: number;
  lastUpdate?: number;
}

export function ConnectionStatus({
  isConnected,
  error,
  eventCount,
  lastUpdate,
}: ConnectionStatusProps) {
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  };

  const getStatusColor = () => {
    if (error) return 'bg-red-500';
    if (isConnected) return 'bg-green-500';
    return 'bg-yellow-500';
  };

  const getStatusText = () => {
    if (error) return 'Error';
    if (isConnected) return 'Connected';
    return 'Connecting...';
  };

  return (
    <div className="flex items-center gap-3 text-xs">
      {/* Status indicator */}
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${getStatusColor()} animate-pulse`} />
        <span className="text-gray-300">{getStatusText()}</span>
      </div>

      {/* Event count */}
      <div className="text-gray-400">
        {eventCount} {eventCount === 1 ? 'event' : 'events'}
      </div>

      {/* Last update */}
      {lastUpdate && <div className="text-gray-500">Last update: {formatTime(lastUpdate)}</div>}
    </div>
  );
}
