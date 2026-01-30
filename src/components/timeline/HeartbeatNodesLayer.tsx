/**
 * HeartbeatNodesLayer Component
 * Renders heartbeat nodes on the timeline
 */

'use client';

import { useMemo, useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { TimelineHeartbeat } from '@/lib/timeline/types';
import { HeartbeatDetailModal } from './HeartbeatDetailModal';

interface TooltipProps {
  heartbeat: TimelineHeartbeat;
  position: { x: number; y: number; rect: DOMRect };
  visible: boolean;
}

function Tooltip({ heartbeat, position, visible }: TooltipProps) {
  const [now, setNow] = useState(() => Date.now());

  // Update current time every second
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  if (!visible) return null;

  const scheduledTime = new Date(heartbeat.scheduledAt);
  const timeFromNow = scheduledTime.getTime() - now;
  const minutesFromNow = Math.floor(timeFromNow / (1000 * 60));
  const hoursFromNow = Math.floor(minutesFromNow / 60);
  const remainingMinutes = minutesFromNow % 60;

  // Parse decision if available
  let decisionAction: string | undefined;
  let decisionReasoning: string | undefined;
  if (heartbeat.finalDecision) {
    try {
      const decision = JSON.parse(heartbeat.finalDecision);
      decisionAction = decision.action;
      decisionReasoning = decision.reasoning;
    } catch (e) {
      console.error('Failed to parse decision:', e);
    }
  }

  // Calculate absolute position based on container rect
  const absoluteX = position.rect.left + (position.rect.width * position.x) / 100;
  const absoluteY = position.rect.top + position.y - 60;

  return createPortal(
    <div
      className="fixed z-[9999] bg-gray-900 border border-gray-700 rounded-lg shadow-xl p-3 min-w-[200px] pointer-events-none"
      style={{
        left: `${absoluteX}px`,
        top: `${absoluteY}px`,
        transform: 'translate(-50%, -100%)',
      }}
    >
      {/* Trader name */}
      <div className="text-sm font-semibold mb-2" style={{ color: heartbeat.traderColor }}>
        {heartbeat.traderName}
      </div>

      {/* Scheduled time */}
      <div className="text-xs text-gray-300 mb-1">
        <span className="text-gray-500">Scheduled:</span>{' '}
        {scheduledTime.toLocaleString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        })}{' '}
        UTC
      </div>

      {/* Full date */}
      <div className="text-xs text-gray-400 mb-2">
        {scheduledTime.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        })}{' '}
        at{' '}
        {scheduledTime.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        })}
      </div>

      {/* Time from now */}
      {timeFromNow > 0 && (
        <div className="text-xs text-sky-400 mb-2">
          In {hoursFromNow > 0 ? `${hoursFromNow}h ` : ''}
          {remainingMinutes}m
        </div>
      )}

      {/* Status */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500">Status:</span>
        <span
          className={`text-xs font-medium ${
            heartbeat.status === 'pending'
              ? 'text-yellow-500'
              : heartbeat.status === 'executing'
                ? 'text-blue-500'
                : heartbeat.status === 'completed'
                  ? 'text-green-500'
                  : 'text-red-500'
          }`}
        >
          {heartbeat.status === 'completed' && heartbeat.executionStatus
            ? getExecutionStatusLabel(heartbeat.executionStatus)
            : heartbeat.status.charAt(0).toUpperCase() + heartbeat.status.slice(1)}
        </span>
      </div>

      {/* Show skip reason if applicable */}
      {heartbeat.executionStatus && heartbeat.executionStatus.startsWith('skipped_') && (
        <div className="text-xs text-orange-400 mt-1">
          {getSkipReasonLabel(heartbeat.executionStatus)}
        </div>
      )}

      {/* Decision Action (for historical heartbeats) */}
      {decisionAction && (
        <div className="mt-2 pt-2 border-t border-gray-700">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Action:</span>
            <span className={`text-xs font-medium ${getActionTextColor(decisionAction)}`}>
              {getActionLabel(decisionAction)}
            </span>
          </div>
          {decisionReasoning && (
            <div className="text-xs text-gray-400 mt-1 line-clamp-2 max-w-[250px]">
              {decisionReasoning}
            </div>
          )}
        </div>
      )}

      {/* Interval */}
      <div className="text-xs text-gray-500 mt-1">Interval: {heartbeat.intervalSeconds}s</div>

      {/* Arrow */}
      <div
        className="absolute left-1/2 -translate-x-1/2 w-3 h-3 bg-gray-900 border-r border-b border-gray-700 rotate-45"
        style={{ top: '100%' }}
      />
    </div>,
    document.body
  );
}

interface HeartbeatNodesLayerProps {
  heartbeats: TimelineHeartbeat[];
  currentTime: Date;
}

export function HeartbeatNodesLayer({ heartbeats, currentTime }: HeartbeatNodesLayerProps) {
  const [hoveredHeartbeat, setHoveredHeartbeat] = useState<TimelineHeartbeat | null>(null);
  const [hoverPosition, setHoverPosition] = useState<{
    x: number;
    y: number;
    rect: DOMRect;
  } | null>(null);
  const [selectedHeartbeat, setSelectedHeartbeat] = useState<TimelineHeartbeat | null>(null);

  const handleMouseEnter = useCallback(
    (heartbeat: TimelineHeartbeat, x: number, y: number, rect: DOMRect) => {
      setHoveredHeartbeat(heartbeat);
      setHoverPosition({ x, y, rect });
    },
    []
  );

  const handleMouseLeave = useCallback(() => {
    setHoveredHeartbeat(null);
    setHoverPosition(null);
  }, []);

  const handleClick = useCallback((heartbeat: TimelineHeartbeat) => {
    // Only allow clicking on completed or failed heartbeats
    if (heartbeat.status === 'completed' || heartbeat.status === 'failed') {
      setSelectedHeartbeat(heartbeat);
    }
  }, []);

  // Calculate unique traders for row layout
  const { traders, nodePositions } = useMemo(() => {
    const traderMap = new Map<number, { name: string; color: string; index: number }>();

    // Get unique traders and assign row indices
    const uniqueTraders = Array.from(new Map(heartbeats.map((h) => [h.traderId, h])).values()).sort(
      (a, b) => a.traderId - b.traderId
    );

    uniqueTraders.forEach((trader, index) => {
      traderMap.set(trader.traderId, {
        name: trader.traderName,
        color: trader.traderColor,
        index,
      });
    });

    // Calculate node positions
    const positions = heartbeats
      .map((heartbeat) => {
        const trader = traderMap.get(heartbeat.traderId);
        if (!trader) return null;

        const scheduledTime = new Date(heartbeat.scheduledAt).getTime();
        const currentTimeMs = currentTime.getTime();
        const rangeMs = 12 * 60 * 60 * 1000; // 12 hours in milliseconds

        // Calculate position as percentage (0 = left edge, 100 = right edge)
        const positionPercent = ((scheduledTime - currentTimeMs) / rangeMs) * 100 + 50;

        return {
          heartbeat,
          trader,
          x: Math.max(0, Math.min(100, positionPercent)),
          y: trader.index * 40 + 20, // 40px row height + 20px padding
        };
      })
      .filter((p): p is NonNullable<typeof p> => p !== null);

    return {
      traders: Array.from(traderMap.values()),
      nodePositions: positions,
    };
  }, [heartbeats, currentTime]);

  if (nodePositions.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-gray-400">
        <p>No heartbeats scheduled</p>
      </div>
    );
  }

  return (
    <div
      ref={setContainerRef}
      className="relative w-full overflow-visible rounded-2xl"
      style={{
        backgroundColor: '#252525',
        height: `${Math.max(160, traders.length * 40 + 40)}px`,
      }}
    >
      {/* Trader row backgrounds */}
      {traders.map((trader) => (
        <div
          key={trader.index}
          className="absolute left-0 right-0 border-b border-gray-700/30"
          style={{
            top: `${trader.index * 40 + 20}px`,
            height: '40px',
          }}
        >
          {/* Trader label */}
          <div
            className="absolute left-2 top-1/2 -translate-y-1/2 text-xs font-medium truncate max-w-[120px]"
            style={{ color: trader.color }}
          >
            {trader.name}
          </div>
        </div>
      ))}

      {/* Center line */}
      <div
        className="absolute top-0 bottom-0 left-1/2 w-px bg-sky-500/50"
        style={{ transform: 'translateX(-50%)' }}
      />

      {/* Heartbeat nodes - using div with absolute positioning */}
      {nodePositions.map(({ heartbeat, x, y }) => {
        const isHistorical = x < 50; // Left of center line
        const decision = parseDecision(heartbeat.finalDecision);
        const isClickable = heartbeat.status === 'completed' || heartbeat.status === 'failed';

        return (
          <div
            key={heartbeat.id}
            className={`absolute flex items-center justify-center group ${
              isClickable ? 'cursor-pointer' : 'cursor-default'
            }`}
            style={{
              left: `${x}%`,
              top: `${y}px`,
              transform: 'translate(-50%, -50%)',
            }}
            onMouseEnter={(e) => {
              const rect = e.currentTarget.parentElement?.getBoundingClientRect();
              if (rect) handleMouseEnter(heartbeat, x, y, rect);
            }}
            onMouseLeave={handleMouseLeave}
            onClick={() => handleClick(heartbeat)}
          >
            {/* Node circle */}
            <div
              className={`
                rounded-full border-2 transition-all
                ${heartbeat.status === 'executing' ? 'animate-ping' : ''}
                ${isClickable ? 'group-hover:scale-125' : 'group-hover:scale-110'}
              `}
              style={{
                width: heartbeat.status === 'executing' ? '16px' : '12px',
                height: heartbeat.status === 'executing' ? '16px' : '12px',
                backgroundColor: getNodeFill(heartbeat.status, isHistorical, decision?.action),
                borderColor: getNodeBorderColor(heartbeat.status),
                opacity: getNodeOpacity(heartbeat.status),
                animationDuration: heartbeat.status === 'executing' ? '1s' : undefined,
                animationIterationCount: heartbeat.status === 'executing' ? 'infinite' : undefined,
              }}
            >
              {/* Status indicator */}
              {heartbeat.status === 'failed' && (
                <span className="flex items-center justify-center text-red-500 font-bold text-xs leading-none">
                  ✕
                </span>
              )}

              {heartbeat.status === 'completed' && !decision && (
                <span className="flex items-center justify-center text-blue-500 font-bold text-xs leading-none">
                  ✓
                </span>
              )}
            </div>
          </div>
        );
      })}

      {/* Tooltip */}
      {hoveredHeartbeat && hoverPosition && (
        <Tooltip heartbeat={hoveredHeartbeat} position={hoverPosition} visible={true} />
      )}

      {/* Legend */}
      <div className="absolute bottom-2 right-2 flex items-center gap-4 text-xs text-gray-400 bg-gray-900/80 rounded-lg px-3 py-2">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full border-2 border-gray-500 bg-transparent" />
          <span>Pending</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-blue-500" />
          <span>Executing</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full border-2 border-blue-500 bg-transparent" />
          <span>Completed</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full border-2 border-red-500 bg-transparent" />
          <span>Failed</span>
        </div>
        <div className="w-px h-4 bg-gray-600 mx-2" />
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-green-500" />
          <span>Long</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <span>Short</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full border-2 border-gray-500 bg-transparent" />
          <span>Hold</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-yellow-500" />
          <span>Close</span>
        </div>
      </div>

      {/* Heartbeat Detail Modal */}
      {selectedHeartbeat && (
        <HeartbeatDetailModal
          heartbeatId={selectedHeartbeat.id}
          traderId={selectedHeartbeat.traderId}
          traderName={selectedHeartbeat.traderName}
          onClose={() => setSelectedHeartbeat(null)}
        />
      )}
    </div>
  );
}

/**
 * Parse decision from JSON string
 */
function parseDecision(decisionJson?: string): { action: string } | undefined {
  if (!decisionJson) return undefined;
  try {
    return JSON.parse(decisionJson);
  } catch {
    return undefined;
  }
}

/**
 * Get node border color based on status
 */
function getNodeBorderColor(status: string): string {
  switch (status) {
    case 'pending':
      return '#6B7280'; // Gray
    case 'executing':
      return '#3B82F6'; // Blue
    case 'completed':
      return '#3B82F6'; // Blue
    case 'failed':
      return '#EF4444'; // Red
    default:
      return '#6B7280';
  }
}

/**
 * Get node fill color based on status and decision action
 */
function getNodeFill(status: string, isHistorical: boolean, action?: string): string {
  // For non-completed status, use original logic
  if (status !== 'completed') {
    switch (status) {
      case 'pending':
        return 'transparent';
      case 'executing':
        return '#3B82F6'; // Blue
      case 'failed':
        return 'transparent';
      default:
        return 'transparent';
    }
  }

  // For completed status, if it's historical and has a decision, use action-based color
  if (isHistorical && action) {
    switch (action) {
      case 'open_long':
        return '#22C55E'; // Green
      case 'open_short':
        return '#EF4444'; // Red
      case 'hold':
        return 'transparent'; // No fill
      case 'close_position':
      case 'close_all':
      case 'modify_sl_tp':
        return '#EAB308'; // Yellow
      default:
        return 'transparent';
    }
  }

  // Default for completed: hollow blue
  return 'transparent';
}

/**
 * Get node opacity based on status
 */
function getNodeOpacity(status: string): number {
  switch (status) {
    case 'pending':
      return 0.8;
    case 'executing':
      return 1;
    case 'completed':
      return 0.8;
    case 'failed':
      return 0.8;
    default:
      return 0.8;
  }
}

/**
 * Get action text color
 */
function getActionTextColor(action: string): string {
  switch (action) {
    case 'open_long':
      return 'text-green-500';
    case 'open_short':
      return 'text-red-500';
    case 'hold':
      return 'text-gray-400';
    case 'close_position':
    case 'close_all':
    case 'modify_sl_tp':
      return 'text-yellow-500';
    default:
      return 'text-gray-400';
  }
}

/**
 * Get action label
 */
function getActionLabel(action: string): string {
  switch (action) {
    case 'open_long':
      return 'Open Long';
    case 'open_short':
      return 'Open Short';
    case 'hold':
      return 'Hold';
    case 'close_position':
      return 'Close Position';
    case 'close_all':
      return 'Close All';
    case 'modify_sl_tp':
      return 'Modify SL/TP';
    default:
      return action.charAt(0).toUpperCase() + action.slice(1);
  }
}

/**
 * Get human-readable label for execution status
 */
function getExecutionStatusLabel(status: string): string {
  switch (status) {
    case 'completed':
      return 'Completed';
    case 'failed':
      return 'Failed';
    case 'skipped_outside_hours':
      return 'Skipped (Outside Hours)';
    case 'skipped_no_intervals':
      return 'Skipped (No Intervals)';
    case 'skipped_no_readers':
      return 'Skipped (No Readers)';
    default:
      return status.charAt(0).toUpperCase() + status.slice(1);
  }
}

/**
 * Get skip reason description
 */
function getSkipReasonLabel(status: string): string {
  switch (status) {
    case 'skipped_outside_hours':
      return '⏰ Outside active trading hours';
    case 'skipped_no_intervals':
      return '📊 No K-line intervals configured';
    case 'skipped_no_readers':
      return '📖 No data readers configured';
    default:
      return '';
  }
}
