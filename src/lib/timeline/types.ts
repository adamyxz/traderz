/**
 * Timeline Visualization and Auto Heartbeat Scheduling System
 * Type definitions
 */

/**
 * Timeline configuration stored in systemConfigurations
 * Key: 'timeline_config'
 * Value: JSON.stringify(TimelineConfig)
 */
export interface TimelineConfig {
  enabled: boolean;
  enabledAt?: string; // ISO timestamp when timeline was first enabled
}

/**
 * Timeline node type - distinguishes between heartbeat and optimization nodes
 */
export type TimelineNodeType = 'heartbeat' | 'optimization';

/**
 * Heartbeat schedule for a single trader
 */
export interface HeartbeatSchedule {
  traderId: number;
  traderName: string;
  intervalSeconds: number;
  nextHeartbeatAt: Date; // UTC timestamp
  staggerOffset: number; // Offset in seconds from base interval
  traderColor: string; // Hex color for visualization
  heartbeatCount: number; // Current heartbeat count for optimization cycle
  optimizationCycleCount: number; // Number of heartbeats between optimizations (0 = disabled)
  isNextOptimization: boolean; // Whether the next scheduled node is an optimization
}

/**
 * Timeline heartbeat node for API responses
 */
export interface TimelineHeartbeat {
  id: string; // Unique ID for this heartbeat instance
  traderId: number;
  traderName: string;
  scheduledAt: string; // ISO timestamp
  executedAt?: string; // ISO timestamp
  status: HeartbeatStatus;
  intervalSeconds: number;
  traderColor: string;
  executionStatus?: string; // Original execution status from heartbeat history (e.g., 'skipped_outside_hours')
  finalDecision?: string; // JSON string of ComprehensiveDecision (includes action, confidence, reasoning)
  nodeType: TimelineNodeType; // Type of node: heartbeat or optimization
  optimizationId?: number; // Optimization record ID (if nodeType is 'optimization')
  optimizationReasoning?: string; // Optimization reasoning (if nodeType is 'optimization')
}

/**
 * Heartbeat execution status
 */
export type HeartbeatStatus =
  | 'pending' // Scheduled but not yet executed
  | 'executing' // Currently executing
  | 'completed' // Successfully completed
  | 'failed'; // Execution failed

/**
 * SSE event types for timeline updates
 */
export type TimelineEventType =
  | 'heartbeat.scheduled'
  | 'heartbeat.started'
  | 'heartbeat.completed'
  | 'heartbeat.failed'
  | 'optimization.scheduled'
  | 'optimization.started'
  | 'optimization.completed'
  | 'optimization.failed'
  | 'timeline.enabled'
  | 'timeline.disabled';

/**
 * SSE event payload
 */
export interface TimelineEvent {
  type: TimelineEventType;
  data: TimelineEventData;
  timestamp: string; // ISO timestamp
}

/**
 * Event data for each event type
 */
export type TimelineEventData =
  | { heartbeat: TimelineHeartbeat } // For heartbeat events
  | { enabled: boolean; enabledAt?: string }; // For timeline state events

/**
 * Trader info with minimum interval for scheduling
 */
export interface TraderWithMinInterval {
  id: number;
  name: string;
  minIntervalSeconds: number;
  status: string;
}

/**
 * Timeline data API response
 */
export interface TimelineDataResponse {
  currentTime: string; // ISO timestamp
  heartbeats: TimelineHeartbeat[];
}

/**
 * Timeline config API response
 */
export interface TimelineConfigResponse {
  enabled: boolean;
  enabledAt?: string;
  activeTraderCount: number;
}

/**
 * Time range for querying heartbeat data
 */
export interface TimeRange {
  rangeStart: string; // ISO timestamp
  rangeEnd: string; // ISO timestamp
}
