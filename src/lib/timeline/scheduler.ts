/**
 * Timeline Visualization and Auto Heartbeat Scheduling System
 * Main scheduler implementation
 */

import { db } from '@/db';
import { traders, traderKlineIntervals, klineIntervals, systemConfigurations } from '@/db/schema';
import { eq, inArray, count } from 'drizzle-orm';
import { executeHeartbeat } from '@/lib/heartbeat/executor';
import { executeOptimization } from '@/lib/optimization/executor';
import {
  calculateStaggerOffsets,
  calculateFirstHeartbeatTime,
  calculateNextHeartbeatTime,
  getTraderColor,
} from './stagger-algorithm';
import { TIMELINE_CONFIG_KEY, SCHEDULER_CONFIG, DEFAULT_TIMELINE_CONFIG } from './constants';
import type { TimelineConfig, HeartbeatSchedule, TimelineHeartbeat, TimelineEvent } from './types';

/**
 * Timeline Scheduler - Manages automatic heartbeat execution
 */
export class TimelineScheduler {
  private isRunning: boolean = false;
  private schedules: Map<number, HeartbeatSchedule> = new Map();
  private scheduleHistory: Map<string, TimelineHeartbeat> = new Map();
  private eventListeners: Set<(event: TimelineEvent) => void> = new Set();
  private loopTimer: ReturnType<typeof setInterval> | null = null;
  private activeExecutions: Set<number> = new Set(); // Track trader IDs currently executing

  /**
   * Start the scheduler
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('[TimelineScheduler] Already running');
      return;
    }

    console.log('[TimelineScheduler] Starting...');
    this.isRunning = true;

    // Initialize schedules for all enabled traders
    await this.initializeSchedules();

    // Start the main scheduling loop
    this.loopTimer = setInterval(() => {
      this.schedulingLoop().catch((error) => {
        console.error('[TimelineScheduler] Loop error:', error);
      });
    }, SCHEDULER_CONFIG.loopIntervalMs);

    // Emit timeline.enabled event
    this.emitEvent({
      type: 'timeline.enabled',
      data: { enabled: true, enabledAt: new Date().toISOString() },
      timestamp: new Date().toISOString(),
    });

    console.log('[TimelineScheduler] Started successfully');
  }

  /**
   * Stop the scheduler
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      console.log('[TimelineScheduler] Not running');
      return;
    }

    console.log('[TimelineScheduler] Stopping...');
    this.isRunning = false;

    // Clear the loop timer
    if (this.loopTimer) {
      clearInterval(this.loopTimer);
      this.loopTimer = null;
    }

    // Clear schedules
    this.schedules.clear();
    this.scheduleHistory.clear();

    // Emit timeline.disabled event
    this.emitEvent({
      type: 'timeline.disabled',
      data: { enabled: false },
      timestamp: new Date().toISOString(),
    });

    console.log('[TimelineScheduler] Stopped');
  }

  /**
   * Check if scheduler is running
   */
  isActive(): boolean {
    return this.isRunning;
  }

  /**
   * Get current configuration
   */
  async getConfig(): Promise<TimelineConfig> {
    const [config] = await db
      .select()
      .from(systemConfigurations)
      .where(eq(systemConfigurations.key, TIMELINE_CONFIG_KEY))
      .limit(1);

    if (!config) {
      return DEFAULT_TIMELINE_CONFIG;
    }

    try {
      return JSON.parse(config.value) as TimelineConfig;
    } catch {
      return DEFAULT_TIMELINE_CONFIG;
    }
  }

  /**
   * Get optimization cycle count from system settings
   */
  private async getOptimizationCycleCount(): Promise<number> {
    const [config] = await db
      .select()
      .from(systemConfigurations)
      .where(eq(systemConfigurations.key, 'optimization_cycle_heartbeat_count'))
      .limit(1);

    return config ? Math.max(0, parseInt(config.value, 10)) : 10;
  }

  /**
   * Update configuration
   */
  async setConfig(config: Partial<TimelineConfig>): Promise<void> {
    const currentConfig = await this.getConfig();
    const newConfig = { ...currentConfig, ...config };

    if (config.enabled !== undefined && config.enabled !== currentConfig.enabled) {
      if (config.enabled) {
        newConfig.enabledAt = new Date().toISOString();
        await this.start();
      } else {
        await this.stop();
      }
    }

    await db
      .insert(systemConfigurations)
      .values({
        key: TIMELINE_CONFIG_KEY,
        value: JSON.stringify(newConfig),
        description: 'Timeline visualization and auto heartbeat scheduling configuration',
      })
      .onConflictDoUpdate({
        target: systemConfigurations.key,
        set: {
          value: JSON.stringify(newConfig),
          updatedAt: new Date(),
        },
      });
  }

  /**
   * Get heartbeat data for a time range
   */
  async getHeartbeatData(rangeStart: Date, rangeEnd: Date): Promise<TimelineHeartbeat[]> {
    const heartbeats: TimelineHeartbeat[] = [];

    // Get all schedules
    for (const [traderId, schedule] of this.schedules) {
      const intervalMs = schedule.intervalSeconds * 1000;

      // Start from the next heartbeat
      let heartbeatTime = schedule.nextHeartbeatAt;

      // If next heartbeat is after range end, go backwards to find first heartbeat in range
      while (heartbeatTime > rangeEnd) {
        heartbeatTime = new Date(heartbeatTime.getTime() - intervalMs);
      }

      // If heartbeat is before range start, go forwards to find first heartbeat in range
      while (heartbeatTime < rangeStart) {
        heartbeatTime = new Date(heartbeatTime.getTime() + intervalMs);
      }

      // Calculate the heartbeat count for the first heartbeat in the range
      // We need to work backwards from the current heartbeatCount
      const currentHeartbeatTime = schedule.nextHeartbeatAt.getTime();
      const targetHeartbeatTime = heartbeatTime.getTime();
      const beatsDiff = Math.round((currentHeartbeatTime - targetHeartbeatTime) / intervalMs);
      const baseHeartbeatCount = schedule.heartbeatCount - beatsDiff;

      // Now generate all heartbeats within the range
      let heartbeatIndex = 0;
      while (heartbeatTime <= rangeEnd) {
        const heartbeatId = `${traderId}-${heartbeatTime.getTime()}`;
        const existing = this.scheduleHistory.get(heartbeatId);

        // Calculate heartbeat count for this node
        const nodeHeartbeatCount = baseHeartbeatCount + heartbeatIndex;
        const isOptimizationNode =
          schedule.optimizationCycleCount > 0 &&
          (nodeHeartbeatCount + 1) % schedule.optimizationCycleCount === 0;

        heartbeats.push({
          id: heartbeatId,
          traderId: schedule.traderId,
          traderName: schedule.traderName,
          scheduledAt: heartbeatTime.toISOString(),
          executedAt: existing?.executedAt,
          status: existing?.status || 'pending',
          intervalSeconds: schedule.intervalSeconds,
          traderColor: schedule.traderColor,
          executionStatus: existing?.executionStatus,
          finalDecision: existing?.finalDecision,
          nodeType: existing?.nodeType || (isOptimizationNode ? 'optimization' : 'heartbeat'),
          optimizationId: existing?.optimizationId,
          optimizationReasoning: existing?.optimizationReasoning,
        });

        // Move to next heartbeat
        heartbeatTime = new Date(heartbeatTime.getTime() + intervalMs);
        heartbeatIndex++;
      }

      // Also include recently completed heartbeats from scheduleHistory that are within range
      // This handles the case where a heartbeat just completed and we want to show it
      for (const [historyId, historyHeartbeat] of this.scheduleHistory.entries()) {
        // Only check heartbeats for this trader
        if (historyHeartbeat.traderId !== traderId) continue;

        const scheduledTime = new Date(historyHeartbeat.scheduledAt);

        // Skip if outside time range
        if (scheduledTime < rangeStart || scheduledTime > rangeEnd) continue;

        // Check if this heartbeat is already in the list
        const alreadyIncluded = heartbeats.some((hb) => hb.id === historyId);
        if (alreadyIncluded) continue;

        // Add the completed heartbeat from history with all its fields
        heartbeats.push({
          id: historyHeartbeat.id,
          traderId: historyHeartbeat.traderId,
          traderName: historyHeartbeat.traderName,
          scheduledAt: historyHeartbeat.scheduledAt,
          executedAt: historyHeartbeat.executedAt,
          status: historyHeartbeat.status,
          intervalSeconds: historyHeartbeat.intervalSeconds,
          traderColor: historyHeartbeat.traderColor,
          executionStatus: historyHeartbeat.executionStatus,
          finalDecision: historyHeartbeat.finalDecision,
          nodeType: historyHeartbeat.nodeType,
          optimizationId: historyHeartbeat.optimizationId,
          optimizationReasoning: historyHeartbeat.optimizationReasoning,
        });
      }
    }

    return heartbeats.sort((a, b) => {
      return new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime();
    });
  }

  /**
   * Get active trader count
   */
  async getActiveTraderCount(): Promise<number> {
    const result = await db
      .select({ count: count() })
      .from(traders)
      .where(eq(traders.status, 'enabled'));

    return result[0]?.count || 0;
  }

  /**
   * Add event listener for SSE
   */
  addEventListener(listener: (event: TimelineEvent) => void): void {
    this.eventListeners.add(listener);
  }

  /**
   * Remove event listener
   */
  removeEventListener(listener: (event: TimelineEvent) => void): void {
    this.eventListeners.delete(listener);
  }

  /**
   * Initialize schedules for all enabled traders
   */
  private async initializeSchedules(): Promise<void> {
    console.log('[TimelineScheduler] Initializing schedules...');

    // Get optimization cycle count
    const optimizationCycleCount = await this.getOptimizationCycleCount();
    console.log(`[TimelineScheduler] Optimization cycle count: ${optimizationCycleCount}`);

    // Get all enabled traders with their minimum k-line intervals
    const enabledTraders = await db
      .select({
        id: traders.id,
        name: traders.name,
        status: traders.status,
      })
      .from(traders)
      .where(eq(traders.status, 'enabled'));

    console.log(`[TimelineScheduler] Found ${enabledTraders.length} enabled traders`);

    if (enabledTraders.length === 0) {
      console.log('[TimelineScheduler] No enabled traders found');
      return;
    }

    // Get minimum intervals for each trader
    const tradersWithIntervals: Array<{
      id: number;
      name: string;
      minIntervalSeconds: number;
    }> = [];

    for (const trader of enabledTraders) {
      // Get k-line intervals for this trader
      const intervalRelations = await db
        .select()
        .from(traderKlineIntervals)
        .where(eq(traderKlineIntervals.traderId, trader.id));

      if (intervalRelations.length === 0) {
        console.log(
          `[TimelineScheduler] Trader ${trader.name} (${trader.id}) has no intervals, skipping`
        );
        continue;
      }

      // Get interval details
      const intervals = await db
        .select({ seconds: klineIntervals.seconds })
        .from(klineIntervals)
        .where(
          inArray(
            klineIntervals.id,
            intervalRelations.map((r) => r.klineIntervalId)
          )
        );

      const minInterval = Math.min(...intervals.map((i) => i.seconds));
      console.log(
        `[TimelineScheduler] Trader ${trader.name} (${trader.id}) min interval: ${minInterval}s`
      );

      tradersWithIntervals.push({
        id: trader.id,
        name: trader.name,
        minIntervalSeconds: minInterval,
      });
    }

    console.log(
      `[TimelineScheduler] Processing ${tradersWithIntervals.length} traders with intervals`
    );

    // Calculate stagger offsets using golden ratio
    const offsets = calculateStaggerOffsets(tradersWithIntervals);

    // Create schedules
    const now = new Date();
    console.log('[TimelineScheduler] Current time (UTC):', now.toISOString());

    for (const trader of tradersWithIntervals) {
      const offset = offsets.get(trader.id) || 0;
      const firstHeartbeat = calculateFirstHeartbeatTime(now, trader.minIntervalSeconds, offset);

      // Initialize heartbeat count
      // Use 0-based counting: start from 0, optimization happens when count reaches cycleCount
      // This ensures the first node is always a heartbeat (not optimization)
      const initialHeartbeatCount = 0;

      // Check if the next node should be optimization
      // First node is at count=0, so it's never optimization
      const isNextOptimization = false;

      this.schedules.set(trader.id, {
        traderId: trader.id,
        traderName: trader.name,
        intervalSeconds: trader.minIntervalSeconds,
        nextHeartbeatAt: firstHeartbeat,
        staggerOffset: offset,
        traderColor: getTraderColor(trader.id),
        heartbeatCount: initialHeartbeatCount,
        optimizationCycleCount,
        isNextOptimization,
      });

      console.log(
        `[TimelineScheduler] Scheduled ${trader.name} (${trader.id}): every ${trader.minIntervalSeconds}s, offset ${offset}s, first at ${firstHeartbeat.toISOString()}, heartbeat count: ${initialHeartbeatCount}, next is optimization: ${isNextOptimization}`
      );
    }

    console.log(`[TimelineScheduler] Initialized ${this.schedules.size} trader schedules`);
  }

  /**
   * Main scheduling loop - runs every second
   */
  private async schedulingLoop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    const now = new Date();
    const dueTraderIds: number[] = [];

    // Check each schedule for due heartbeats
    for (const [traderId, schedule] of this.schedules) {
      if (schedule.nextHeartbeatAt <= now && !this.activeExecutions.has(traderId)) {
        dueTraderIds.push(traderId);
      }
    }

    if (dueTraderIds.length === 0) {
      return;
    }

    console.log(`[TimelineScheduler] Executing ${dueTraderIds.length} due heartbeats`);

    // Execute due heartbeats with concurrency limit
    await this.executeDueHeartbeats(dueTraderIds);
  }

  /**
   * Execute due heartbeats with concurrency control
   */
  private async executeDueHeartbeats(traderIds: number[]): Promise<void> {
    // Process in chunks to limit concurrency
    const maxConcurrent = SCHEDULER_CONFIG.maxConcurrentExecutions;

    for (let i = 0; i < traderIds.length; i += maxConcurrent) {
      const chunk = traderIds.slice(i, i + maxConcurrent);

      await Promise.allSettled(chunk.map((traderId) => this.executeTraderHeartbeat(traderId)));
    }
  }

  /**
   * Execute heartbeat for a single trader
   */
  private async executeTraderHeartbeat(traderId: number): Promise<void> {
    const schedule = this.schedules.get(traderId);
    if (!schedule) {
      console.error(`[TimelineScheduler] No schedule found for trader ${traderId}`);
      return;
    }

    // Mark as executing
    this.activeExecutions.add(traderId);

    const heartbeatId = `${traderId}-${schedule.nextHeartbeatAt.getTime()}`;

    // Determine if this is an optimization node
    const isOptimization = schedule.optimizationCycleCount > 0 && schedule.isNextOptimization;

    // Create heartbeat record
    const heartbeat: TimelineHeartbeat = {
      id: heartbeatId,
      traderId: schedule.traderId,
      traderName: schedule.traderName,
      scheduledAt: schedule.nextHeartbeatAt.toISOString(),
      status: 'executing',
      intervalSeconds: schedule.intervalSeconds,
      traderColor: schedule.traderColor,
      nodeType: isOptimization ? 'optimization' : 'heartbeat',
    };

    this.scheduleHistory.set(heartbeatId, heartbeat);

    // Emit started event
    this.emitEvent({
      type: isOptimization ? 'optimization.started' : 'heartbeat.started',
      data: { heartbeat },
      timestamp: new Date().toISOString(),
    });

    try {
      // Get trader from database
      const [trader] = await db.select().from(traders).where(eq(traders.id, traderId)).limit(1);

      if (!trader) {
        throw new Error('Trader not found');
      }

      if (isOptimization) {
        // Execute optimization
        console.log(
          `[TimelineScheduler] Executing optimization for ${schedule.traderName} (trader ${traderId})`
        );

        const result = await executeOptimization({ traderId, force: true });

        if (result.success) {
          // Update heartbeat record as completed
          heartbeat.status = 'completed';
          heartbeat.optimizationId = result.optimizationId;
          heartbeat.optimizationReasoning = result.data?.reasoning;
        } else {
          // Optimization failed
          heartbeat.status = 'failed';
          console.error(
            `[TimelineScheduler] Optimization failed for ${schedule.traderName}: ${result.error}`
          );
        }
      } else {
        // Execute heartbeat
        const result = await executeHeartbeat(trader);

        // Map heartbeat history status to timeline status
        // History statuses: pending, in_progress, completed, failed, skipped_outside_hours, skipped_no_intervals, skipped_no_readers
        // Timeline statuses: pending, executing, completed, failed
        let timelineStatus: 'completed' | 'failed' = 'completed';
        if (result.status === 'completed') {
          timelineStatus = 'completed';
        } else if (result.status === 'failed') {
          timelineStatus = 'failed';
        } else if (result.status.startsWith('skipped_')) {
          // Skipped heartbeats are considered "completed" in the timeline sense
          // They ran successfully but decided not to take action
          timelineStatus = 'completed';
          console.log(
            `[TimelineScheduler] ${schedule.traderName} heartbeat skipped: ${result.status}`
          );
        } else {
          timelineStatus = 'failed';
        }

        heartbeat.status = timelineStatus;
        heartbeat.executionStatus = result.status; // Store original status
        heartbeat.finalDecision = result.finalDecision || undefined; // Store final decision JSON
      }

      heartbeat.executedAt = new Date().toISOString();

      // Update scheduleHistory with the completed heartbeat
      this.scheduleHistory.set(heartbeatId, heartbeat);

      // Emit completion event BEFORE updating schedule
      this.emitEvent({
        type:
          heartbeat.status === 'completed'
            ? isOptimization
              ? 'optimization.completed'
              : 'heartbeat.completed'
            : isOptimization
              ? 'optimization.failed'
              : 'heartbeat.failed',
        data: { heartbeat },
        timestamp: new Date().toISOString(),
      });

      // Update schedule for next heartbeat AFTER sending event
      schedule.nextHeartbeatAt = calculateNextHeartbeatTime(
        schedule.nextHeartbeatAt,
        schedule.intervalSeconds
      );

      // Update heartbeat count and calculate next optimization
      if (schedule.optimizationCycleCount > 0) {
        if (isOptimization) {
          // After optimization, reset count to 0 to start a new cycle
          schedule.heartbeatCount = 0;
        } else {
          // After heartbeat, increment count
          schedule.heartbeatCount += 1;
        }
        // Next node is optimization if count reaches or exceeds cycleCount
        schedule.isNextOptimization = schedule.heartbeatCount >= schedule.optimizationCycleCount;
      }

      console.log(
        `[TimelineScheduler] ${schedule.traderName} ${isOptimization ? 'optimization' : 'heartbeat'} ${heartbeat.status}, next at ${schedule.nextHeartbeatAt.toISOString()}, heartbeat count: ${schedule.heartbeatCount}, next is optimization: ${schedule.isNextOptimization}`
      );
    } catch (error) {
      console.error(
        `[TimelineScheduler] Error executing ${isOptimization ? 'optimization' : 'heartbeat'} for ${schedule.traderName}:`,
        error
      );

      // Update heartbeat record as failed
      heartbeat.status = 'failed';
      heartbeat.executedAt = new Date().toISOString();

      // Update scheduleHistory with the failed heartbeat
      this.scheduleHistory.set(heartbeatId, heartbeat);

      // Emit failure event BEFORE updating nextHeartbeatAt
      this.emitEvent({
        type: isOptimization ? 'optimization.failed' : 'heartbeat.failed',
        data: { heartbeat },
        timestamp: new Date().toISOString(),
      });

      // Still update schedule for next heartbeat AFTER sending event
      schedule.nextHeartbeatAt = calculateNextHeartbeatTime(
        schedule.nextHeartbeatAt,
        schedule.intervalSeconds
      );

      // Update heartbeat count and calculate next optimization even on failure
      if (schedule.optimizationCycleCount > 0) {
        if (isOptimization) {
          // After optimization, reset count to 0 to start a new cycle
          schedule.heartbeatCount = 0;
        } else {
          // After heartbeat, increment count
          schedule.heartbeatCount += 1;
        }
        // Next node is optimization if count reaches or exceeds cycleCount
        schedule.isNextOptimization = schedule.heartbeatCount >= schedule.optimizationCycleCount;
      }
    } finally {
      // Mark as no longer executing
      this.activeExecutions.delete(traderId);
    }
  }

  /**
   * Emit event to all listeners
   */
  private emitEvent(event: TimelineEvent): void {
    for (const listener of this.eventListeners) {
      try {
        listener(event);
      } catch (error) {
        console.error('[TimelineScheduler] Error emitting event:', error);
      }
    }
  }
}

/**
 * Global scheduler instance
 */
let globalScheduler: TimelineScheduler | null = null;

/**
 * Get or create the global scheduler instance
 * Auto-starts if configuration says it should be running
 */
export async function getTimelineScheduler(): Promise<TimelineScheduler> {
  if (!globalScheduler) {
    console.log('[TimelineScheduler] Creating new scheduler instance');
    globalScheduler = new TimelineScheduler();

    // Check if scheduler should be running (e.g., after hot reload)
    const config = await globalScheduler.getConfig();
    console.log('[TimelineScheduler] Config from DB:', { enabled: config.enabled });

    if (config.enabled && !globalScheduler.isActive()) {
      console.log('[TimelineScheduler] Auto-starting from config (hot reload recovery)');
      await globalScheduler.start();
    } else if (config.enabled && globalScheduler.isActive()) {
      console.log('[TimelineScheduler] Already active, skipping start');
    } else {
      console.log('[TimelineScheduler] Config disabled, not starting');
    }
  } else {
    console.log(
      '[TimelineScheduler] Reusing existing scheduler instance, active:',
      globalScheduler.isActive()
    );
  }
  return globalScheduler;
}
