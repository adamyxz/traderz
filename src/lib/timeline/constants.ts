/**
 * Timeline Visualization and Auto Heartbeat Scheduling System
 * Configuration constants
 */

import type { TimelineConfig } from './types';

/**
 * Timeline configuration key in systemConfigurations table
 */
export const TIMELINE_CONFIG_KEY = 'timeline_config';

/**
 * Time range for timeline visualization (12 hours total)
 * Negative = past, Positive = future
 */
export const TIMELINE_RANGE_HOURS = {
  past: -6,
  future: 6,
  total: 12,
};

/**
 * Scheduler configuration
 */
export const SCHEDULER_CONFIG = {
  /**
   * Main scheduling loop interval (milliseconds)
   * Checks every second for due heartbeats
   */
  loopIntervalMs: 1000,

  /**
   * Maximum concurrent heartbeat executions
   */
  maxConcurrentExecutions: 5,

  /**
   * How many hours ahead to pre-schedule heartbeats
   */
  scheduleAheadHours: 12,

  /**
   * Golden ratio for stagger distribution algorithm
   * Ensures even distribution of heartbeat times
   */
  goldenRatio: 0.618033988749,

  /**
   * Default heartbeat colors for traders (rotating)
   */
  defaultColors: [
    '#3B82F6', // blue-500
    '#10B981', // emerald-500
    '#F59E0B', // amber-500
    '#EF4444', // red-500
    '#8B5CF6', // violet-500
    '#EC4899', // pink-500
    '#06B6D4', // cyan-500
    '#84CC16', // lime-500
    '#F97316', // orange-500
    '#6366F1', // indigo-500
    '#14B8A6', // teal-500
    '#A855F7', // purple-500
    '#F43F5E', // rose-500
    '#0EA5E9', // sky-500
    '#22C55E', // green-500
  ],
} as const;

/**
 * Default timeline configuration
 */
export const DEFAULT_TIMELINE_CONFIG: TimelineConfig = {
  enabled: false,
};

/**
 * Heartbeat execution timeout (milliseconds)
 */
export const HEARTBEAT_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Timeline visualization constants
 */
export const TIMELINE_VISUALIZATION = {
  /**
   * Minimum width for a heartbeat node (pixels)
   */
  minNodeWidth: 8,

  /**
   * Maximum width for a heartbeat node (pixels)
   */
  maxNodeWidth: 16,

  /**
   * Vertical spacing between trader rows (pixels)
   */
  rowHeight: 40,

  /**
   * Padding around timeline (pixels)
   */
  padding: 20,

  /**
   * Animation duration for node transitions (milliseconds)
   */
  animationDuration: 300,
} as const;
