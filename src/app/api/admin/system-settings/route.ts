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
};

/**
 * GET /api/admin/system-settings
 * Retrieve all system settings
 */
export async function GET() {
  try {
    // Fetch all system configurations from database
    const configs = await db.select().from(systemConfigurations);

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
    const { minKlineIntervalSeconds, maxIntervalsPerTrader, maxOptionalReadersPerTrader } =
      body as {
        minKlineIntervalSeconds?: number | string;
        maxIntervalsPerTrader?: number | string;
        maxOptionalReadersPerTrader?: number | string;
      };

    // Helper function to update a setting
    const updateSetting = async (
      key: string,
      value: number | string,
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
