/**
 * System Settings API
 * GET /api/admin/system-settings - Get all system settings
 * POST /api/admin/system-settings - Update system settings
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { systemConfigurations } from '@/db/schema';
import { eq } from 'drizzle-orm';

// System setting keys configuration
const SYSTEM_SETTING_KEYS = {
  MIN_KLINE_INTERVAL_SECONDS: 'min_kline_interval_seconds',
  MAX_INTERVALS_PER_TRADER: 'max_intervals_per_trader',
  MAX_OPTIONAL_READERS_PER_TRADER: 'max_optional_readers_per_trader',
  SYSTEM_ENABLED: 'system_enabled',
  OPTIMIZATION_CYCLE_HEARTBEAT_COUNT: 'optimization_cycle_heartbeat_count',
} as const;

// Default values for system settings
const DEFAULT_SETTINGS = {
  [SYSTEM_SETTING_KEYS.MIN_KLINE_INTERVAL_SECONDS]: {
    value: '900', // 15 minutes in seconds
    description:
      'Minimum kline interval allowed for trader generation (in seconds). 900 = 15m, 300 = 5m, 60 = 1m',
  },
  [SYSTEM_SETTING_KEYS.MAX_INTERVALS_PER_TRADER]: {
    value: '4',
    description:
      'Maximum number of kline intervals that can be associated with a single trader. Recommended: 2-4',
  },
  [SYSTEM_SETTING_KEYS.MAX_OPTIONAL_READERS_PER_TRADER]: {
    value: '5',
    description:
      'Maximum number of optional (non-mandatory) readers that can be associated with a single trader. Mandatory readers are always included. Recommended: 2-5',
  },
  [SYSTEM_SETTING_KEYS.SYSTEM_ENABLED]: {
    value: 'false',
    description:
      'Enable/disable system features (timeline visualization and position price auto-update)',
  },
  [SYSTEM_SETTING_KEYS.OPTIMIZATION_CYCLE_HEARTBEAT_COUNT]: {
    value: '10',
    description:
      'Number of heartbeats between automatic trader optimizations. Default: 10. Set to 0 to disable.',
  },
};

/**
 * GET /api/admin/system-settings
 * Retrieve all system settings
 */
export async function GET() {
  try {
    // Fetch all system configurations from database
    const configs = await db.select().from(systemConfigurations);
    console.log('[GET] System configurations from DB:', configs);

    // Convert to key-value map
    const settingsMap = new Map(
      configs.map((c) => [c.key, { value: c.value, description: c.description }])
    );

    // Build response with defaults for missing keys
    const response: Record<string, { value: string; description: string | null }> = {};

    // Add all settings
    for (const [key, defaultValue] of Object.entries(DEFAULT_SETTINGS)) {
      const config = settingsMap.get(key);
      response[key] = {
        value: config?.value || defaultValue.value,
        description: config?.description || defaultValue.description,
      };
    }

    console.log('[GET] Response data:', response);
    console.log('[GET] system_enabled value:', response.system_enabled.value);

    return NextResponse.json({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error('[SystemSettingsAPI] GET error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to retrieve system settings',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/system-settings
 * Update system settings
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      minKlineIntervalSeconds,
      maxIntervalsPerTrader,
      maxOptionalReadersPerTrader,
      systemEnabled,
      optimizationCycleHeartbeatCount,
    } = body as {
      minKlineIntervalSeconds?: number | string;
      maxIntervalsPerTrader?: number | string;
      maxOptionalReadersPerTrader?: number | string;
      systemEnabled?: boolean;
      optimizationCycleHeartbeatCount?: number | string;
    };

    // Helper function to update a setting
    const updateSetting = async (
      key: string,
      value: number | string | undefined,
      validator: (v: number) => boolean,
      errorMessage: string
    ) => {
      if (value !== undefined) {
        const numValue = Number(value);
        if (!validator(numValue)) {
          return { success: false, error: errorMessage };
        }

        const existing = await db
          .select()
          .from(systemConfigurations)
          .where(eq(systemConfigurations.key, key));

        const valueStr = String(numValue);
        const description = DEFAULT_SETTINGS[key as keyof typeof DEFAULT_SETTINGS].description;

        if (existing.length > 0) {
          await db
            .update(systemConfigurations)
            .set({ value: valueStr, description, updatedAt: new Date() })
            .where(eq(systemConfigurations.key, key));
        } else {
          await db.insert(systemConfigurations).values({
            key,
            value: valueStr,
            description,
          });
        }
      }
      return { success: true };
    };

    // Helper function to update a boolean setting
    const updateBooleanSetting = async (key: string, value: boolean | undefined) => {
      console.log('[updateBooleanSetting] key:', key, 'value:', value, 'type:', typeof value);
      if (value !== undefined) {
        const existing = await db
          .select()
          .from(systemConfigurations)
          .where(eq(systemConfigurations.key, key));

        const valueStr = String(value);
        console.log(
          '[updateBooleanSetting] valueStr:',
          valueStr,
          'existing count:',
          existing.length
        );
        const description = DEFAULT_SETTINGS[key as keyof typeof DEFAULT_SETTINGS].description;

        if (existing.length > 0) {
          console.log('[updateBooleanSetting] updating existing record');
          await db
            .update(systemConfigurations)
            .set({ value: valueStr, description, updatedAt: new Date() })
            .where(eq(systemConfigurations.key, key));
        } else {
          console.log('[updateBooleanSetting] inserting new record');
          await db.insert(systemConfigurations).values({
            key,
            value: valueStr,
            description,
          });
        }
        console.log('[updateBooleanSetting] database operation completed');
      } else {
        console.log('[updateBooleanSetting] value is undefined, skipping');
      }
      return { success: true };
    };

    // Helper function to sync timeline_config with system_enabled
    const syncTimelineConfig = async (systemEnabled: boolean) => {
      console.log(
        '[syncTimelineConfig] Syncing timeline_config with system_enabled:',
        systemEnabled
      );
      try {
        const TIMELINE_CONFIG_KEY = 'timeline_config';

        // Get current timeline config
        const [currentConfig] = await db
          .select()
          .from(systemConfigurations)
          .where(eq(systemConfigurations.key, TIMELINE_CONFIG_KEY))
          .limit(1);

        let timelineConfig;
        if (currentConfig) {
          timelineConfig = JSON.parse(currentConfig.value);
        } else {
          timelineConfig = { enabled: false, enabledAt: null };
        }

        // Update enabled status
        const wasEnabled = timelineConfig.enabled;
        timelineConfig.enabled = systemEnabled;

        // Update enabledAt if transitioning from disabled to enabled
        if (systemEnabled && !wasEnabled) {
          timelineConfig.enabledAt = new Date().toISOString();
        }

        // Save to database
        if (currentConfig) {
          await db
            .update(systemConfigurations)
            .set({
              value: JSON.stringify(timelineConfig),
              updatedAt: new Date(),
            })
            .where(eq(systemConfigurations.key, TIMELINE_CONFIG_KEY));
        } else {
          await db.insert(systemConfigurations).values({
            key: TIMELINE_CONFIG_KEY,
            value: JSON.stringify(timelineConfig),
            description: 'Timeline visualization and auto heartbeat scheduling configuration',
          });
        }

        console.log('[syncTimelineConfig] Timeline config updated:', timelineConfig);

        // Start or stop the scheduler
        const { getTimelineScheduler } = await import('@/lib/timeline/scheduler');
        const scheduler = await getTimelineScheduler();

        if (systemEnabled && !scheduler.isActive()) {
          console.log('[syncTimelineConfig] Starting timeline scheduler');
          await scheduler.start();
        } else if (!systemEnabled && scheduler.isActive()) {
          console.log('[syncTimelineConfig] Stopping timeline scheduler');
          await scheduler.stop();
        }
      } catch (error) {
        console.error('[syncTimelineConfig] Error syncing timeline config:', error);
        throw error;
      }
    };

    // Update min kline interval
    const minIntervalResult = await updateSetting(
      SYSTEM_SETTING_KEYS.MIN_KLINE_INTERVAL_SECONDS,
      minKlineIntervalSeconds,
      (v) => !isNaN(v) && v >= 60,
      'minKlineIntervalSeconds must be a valid number >= 60 (1 minute)'
    );

    if (!minIntervalResult.success) {
      return NextResponse.json(minIntervalResult, { status: 400 });
    }

    // Update max intervals per trader
    const maxIntervalsResult = await updateSetting(
      SYSTEM_SETTING_KEYS.MAX_INTERVALS_PER_TRADER,
      maxIntervalsPerTrader,
      (v) => !isNaN(v) && v >= 1 && v <= 10,
      'maxIntervalsPerTrader must be a valid number between 1 and 10'
    );

    if (!maxIntervalsResult.success) {
      return NextResponse.json(maxIntervalsResult, { status: 400 });
    }

    // Update max optional readers per trader
    const maxReadersResult = await updateSetting(
      SYSTEM_SETTING_KEYS.MAX_OPTIONAL_READERS_PER_TRADER,
      maxOptionalReadersPerTrader,
      (v) => !isNaN(v) && v >= 1 && v <= 20,
      'maxOptionalReadersPerTrader must be a valid number between 1 and 20'
    );

    if (!maxReadersResult.success) {
      return NextResponse.json(maxReadersResult, { status: 400 });
    }

    // Update system enabled
    const systemResult = await updateBooleanSetting(
      SYSTEM_SETTING_KEYS.SYSTEM_ENABLED,
      systemEnabled
    );

    if (!systemResult.success) {
      return NextResponse.json(systemResult, { status: 400 });
    }

    // Sync timeline_config when system_enabled changes
    if (systemEnabled !== undefined) {
      await syncTimelineConfig(systemEnabled);
    }

    // Update optimization cycle heartbeat count
    const optimizationCycleResult = await updateSetting(
      SYSTEM_SETTING_KEYS.OPTIMIZATION_CYCLE_HEARTBEAT_COUNT,
      optimizationCycleHeartbeatCount,
      (v) => !isNaN(v) && v >= 0 && v <= 100,
      'optimizationCycleHeartbeatCount must be a valid number between 0 and 100 (0 = disabled)'
    );

    if (!optimizationCycleResult.success) {
      return NextResponse.json(optimizationCycleResult, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: 'System settings updated successfully',
    });
  } catch (error) {
    console.error('[SystemSettingsAPI] POST error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update system settings',
      },
      { status: 500 }
    );
  }
}
