/**
 * Timeline Configuration API
 * GET /api/admin/timeline/config - Get current configuration
 * POST /api/admin/timeline/config - Update configuration
 */

import { NextRequest, NextResponse } from 'next/server';
import { getTimelineScheduler } from '@/lib/timeline/scheduler';
import type { TimelineConfigResponse } from '@/lib/timeline/types';

export async function GET() {
  try {
    const scheduler = await getTimelineScheduler();
    const config = await scheduler.getConfig();
    const activeTraderCount = await scheduler.getActiveTraderCount();

    const response: TimelineConfigResponse = {
      enabled: config.enabled,
      enabledAt: config.enabledAt,
      activeTraderCount,
    };

    return NextResponse.json({ success: true, data: response });
  } catch (error) {
    console.error('[TimelineConfigAPI] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get timeline configuration' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { enabled } = body as { enabled?: boolean };

    if (typeof enabled !== 'boolean') {
      return NextResponse.json(
        { success: false, error: 'enabled field is required and must be a boolean' },
        { status: 400 }
      );
    }

    const scheduler = await getTimelineScheduler();
    await scheduler.setConfig({ enabled });

    const config = await scheduler.getConfig();
    const activeTraderCount = await scheduler.getActiveTraderCount();

    const response: TimelineConfigResponse = {
      enabled: config.enabled,
      enabledAt: config.enabledAt,
      activeTraderCount,
    };

    return NextResponse.json({ success: true, data: response });
  } catch (error) {
    console.error('[TimelineConfigAPI] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update timeline configuration' },
      { status: 500 }
    );
  }
}
