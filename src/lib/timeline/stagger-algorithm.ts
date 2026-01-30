/**
 * Timeline Visualization and Auto Heartbeat Scheduling System
 * Stagger distribution algorithm using golden ratio
 */

import { SCHEDULER_CONFIG } from './constants';

/**
 * Calculate stagger offsets for multiple traders using golden ratio
 *
 * This ensures that heartbeats are evenly distributed across time,
 * preventing all traders from executing at the same moment.
 *
 * @param traders - Array of traders with their minimum intervals
 * @returns Map of traderId to offset in seconds
 *
 * @example
 * const traders = [
 *   { id: 1, minIntervalSeconds: 300 },
 *   { id: 2, minIntervalSeconds: 600 },
 * ];
 * const offsets = calculateStaggerOffsets(traders);
 * // offsets.get(1) might be 37
 * // offsets.get(2) might be 185
 */
export function calculateStaggerOffsets(
  traders: Array<{ id: number; minIntervalSeconds: number }>
): Map<number, number> {
  const offsets = new Map<number, number>();

  traders.forEach((trader, index) => {
    // Use golden ratio to ensure even distribution
    // The golden ratio (φ ≈ 0.618) has properties that minimize collisions
    const offset = Math.floor(
      (index * SCHEDULER_CONFIG.goldenRatio * trader.minIntervalSeconds) % trader.minIntervalSeconds
    );

    offsets.set(trader.id, offset);
  });

  return offsets;
}

/**
 * Calculate the first heartbeat time for a trader
 *
 * @param baseTime - Base time to start from (usually now)
 * @param intervalSeconds - Heartbeat interval in seconds
 * @param staggerOffset - Offset in seconds from the base interval
 * @returns Date object for the first heartbeat
 *
 * @example
 * const baseTime = new Date('2024-01-01T00:00:00Z');
 * const firstHeartbeat = calculateFirstHeartbeatTime(baseTime, 300, 37);
 * // Returns: 2024-01-01T00:00:37Z
 */
export function calculateFirstHeartbeatTime(
  baseTime: Date,
  intervalSeconds: number,
  staggerOffset: number
): Date {
  const baseMs = baseTime.getTime();
  const offsetMs = staggerOffset * 1000;

  // Calculate the first occurrence after baseTime + offset
  const firstHeartbeatMs = baseMs + offsetMs;

  return new Date(firstHeartbeatMs);
}

/**
 * Calculate the next heartbeat time based on the previous one
 *
 * @param previousTime - Previous heartbeat time
 * @param intervalSeconds - Heartbeat interval in seconds
 * @returns Date object for the next heartbeat
 *
 * @example
 * const previous = new Date('2024-01-01T00:00:00Z');
 * const next = calculateNextHeartbeatTime(previous, 300);
 * // Returns: 2024-01-01T00:05:00Z
 */
export function calculateNextHeartbeatTime(previousTime: Date, intervalSeconds: number): Date {
  const intervalMs = intervalSeconds * 1000;
  const nextMs = previousTime.getTime() + intervalMs;

  return new Date(nextMs);
}

/**
 * Generate all heartbeat times for a trader within a time range
 *
 * @param startTime - Start of the range
 * @param endTime - End of the range
 * @param intervalSeconds - Heartbeat interval in seconds
 * @param staggerOffset - Offset in seconds from the base interval
 * @returns Array of scheduled heartbeat times
 *
 * @example
 * const start = new Date('2024-01-01T00:00:00Z');
 * const end = new Date('2024-01-01T01:00:00Z');
 * const times = generateHeartbeatTimes(start, end, 300, 37);
 * // Returns heartbeat times every 5 seconds within the hour
 */
export function generateHeartbeatTimes(
  startTime: Date,
  endTime: Date,
  intervalSeconds: number,
  staggerOffset: number
): Date[] {
  const times: Date[] = [];

  // Calculate the first heartbeat after startTime
  const firstHeartbeat = calculateFirstHeartbeatTime(startTime, intervalSeconds, staggerOffset);

  // If the first heartbeat is after endTime, no heartbeats in range
  if (firstHeartbeat > endTime) {
    return times;
  }

  // Generate all heartbeats from first to endTime
  let currentTime = firstHeartbeat;
  while (currentTime <= endTime) {
    times.push(new Date(currentTime));
    currentTime = calculateNextHeartbeatTime(currentTime, intervalSeconds);
  }

  return times;
}

/**
 * Get a consistent color for a trader based on their ID
 *
 * @param traderId - Trader ID
 * @returns Hex color code
 *
 * @example
 * const color = getTraderColor(1);
 * // Returns: '#3B82F6'
 */
export function getTraderColor(traderId: number): string {
  const colors = SCHEDULER_CONFIG.defaultColors;
  return colors[traderId % colors.length];
}
