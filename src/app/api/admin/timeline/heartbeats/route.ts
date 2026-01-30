/**
 * Timeline Heartbeats Data API
 * GET /api/admin/timeline/heartbeats?rangeStart=<ISO>&rangeEnd=<ISO>
 */

import { NextRequest, NextResponse } from 'next/server';
import { getTimelineScheduler } from '@/lib/timeline/scheduler';
import { TIMELINE_RANGE_HOURS } from '@/lib/timeline/constants';
import type { TimelineDataResponse } from '@/lib/timeline/types';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const rangeStartParam = searchParams.get('rangeStart');
    const rangeEndParam = searchParams.get('rangeEnd');

    // Default range: ±6 hours from now
    const now = new Date();
    const defaultStart = new Date(now.getTime() + TIMELINE_RANGE_HOURS.past * 60 * 60 * 1000);
    const defaultEnd = new Date(now.getTime() + TIMELINE_RANGE_HOURS.future * 60 * 60 * 1000);

    const rangeStart = rangeStartParam ? new Date(rangeStartParam) : defaultStart;
    const rangeEnd = rangeEndParam ? new Date(rangeEndParam) : defaultEnd;

    console.log('[TimelineHeartbeatsAPI] Fetching heartbeats:', {
      rangeStart: rangeStart.toISOString(),
      rangeEnd: rangeEnd.toISOString(),
      now: now.toISOString(),
    });

    // Validate date range
    if (isNaN(rangeStart.getTime()) || isNaN(rangeEnd.getTime())) {
      return NextResponse.json(
        { success: false, error: 'Invalid date range format' },
        { status: 400 }
      );
    }

    if (rangeStart >= rangeEnd) {
      return NextResponse.json(
        { success: false, error: 'rangeStart must be before rangeEnd' },
        { status: 400 }
      );
    }

    const scheduler = getTimelineScheduler();
    const isActive = scheduler.isActive();
    console.log('[TimelineHeartbeatsAPI] Scheduler active:', isActive);

    // If scheduler is not active, return empty heartbeats with a message
    if (!isActive) {
      console.log('[TimelineHeartbeatsAPI] Scheduler not active, returning empty heartbeats');
      const response: TimelineDataResponse = {
        currentTime: now.toISOString(),
        heartbeats: [],
      };
      return NextResponse.json({
        success: true,
        data: response,
        debug: { schedulerActive: isActive, message: 'Scheduler not active' },
      });
    }

    const heartbeats = await scheduler.getHeartbeatData(rangeStart, rangeEnd);

    console.log('[TimelineHeartbeatsAPI] Returning heartbeats:', heartbeats.length);

    // Log first few heartbeats for debugging
    if (heartbeats.length > 0) {
      console.log(
        '[TimelineHeartbeatsAPI] Sample heartbeats:',
        heartbeats.slice(0, 3).map((h) => ({
          id: h.id,
          trader: h.traderName,
          scheduledAt: h.scheduledAt,
          status: h.status,
        }))
      );
    }

    const response: TimelineDataResponse = {
      currentTime: now.toISOString(),
      heartbeats,
    };

    return NextResponse.json({ success: true, data: response });
  } catch (error) {
    console.error('[TimelineHeartbeatsAPI] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get heartbeat data',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
