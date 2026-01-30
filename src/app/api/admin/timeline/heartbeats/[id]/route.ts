/**
 * Single Heartbeat Detail API
 * GET /api/admin/timeline/heartbeats/[id]
 * Get detailed information about a specific heartbeat from history
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { heartbeatHistory } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    // The heartbeat ID format is "traderId-timestamp"
    // We need to find the corresponding heartbeat history record
    const [traderId, timestamp] = id.split('-').map(Number);

    if (isNaN(traderId) || isNaN(timestamp)) {
      return NextResponse.json(
        { success: false, error: 'Invalid heartbeat ID format' },
        { status: 400 }
      );
    }

    // Find heartbeat history record
    // The scheduled time in heartbeat_history should be close to the timestamp
    // We'll query by traderId and find the closest match
    const records = await db
      .select()
      .from(heartbeatHistory)
      .where(eq(heartbeatHistory.traderId, traderId))
      .orderBy(heartbeatHistory.triggeredAt)
      .limit(100);

    // Find the record with triggeredAt closest to the timestamp
    const heartbeatRecord = records.find((record) => {
      const triggeredTime = new Date(record.triggeredAt).getTime();
      // Allow 1 minute tolerance
      return Math.abs(triggeredTime - timestamp) < 60000;
    });

    if (!heartbeatRecord) {
      return NextResponse.json(
        {
          success: false,
          error: 'Heartbeat history not found',
          debug: { traderId, timestamp, recordsFound: records.length },
        },
        { status: 404 }
      );
    }

    // Parse JSON fields
    let microDecisions = null;
    let finalDecision = null;
    let executionResult = null;
    let readersExecuted = null;

    try {
      microDecisions = heartbeatRecord.microDecisions
        ? JSON.parse(heartbeatRecord.microDecisions)
        : null;
    } catch (e) {
      console.error('Failed to parse microDecisions:', e);
    }

    try {
      finalDecision = heartbeatRecord.finalDecision
        ? JSON.parse(heartbeatRecord.finalDecision)
        : null;
    } catch (e) {
      console.error('Failed to parse finalDecision:', e);
    }

    try {
      executionResult = heartbeatRecord.executionResult
        ? JSON.parse(heartbeatRecord.executionResult)
        : null;
    } catch (e) {
      console.error('Failed to parse executionResult:', e);
    }

    try {
      readersExecuted = heartbeatRecord.readersExecuted
        ? JSON.parse(heartbeatRecord.readersExecuted)
        : null;
    } catch (e) {
      console.error('Failed to parse readersExecuted:', e);
    }

    return NextResponse.json({
      success: true,
      data: {
        id: heartbeatRecord.id,
        traderId: heartbeatRecord.traderId,
        status: heartbeatRecord.status,
        triggeredAt: heartbeatRecord.triggeredAt,
        startedAt: heartbeatRecord.startedAt,
        completedAt: heartbeatRecord.completedAt,
        duration: heartbeatRecord.duration,
        wasWithinActiveHours: heartbeatRecord.wasWithinActiveHours,
        microDecisions,
        finalDecision,
        executionAction: heartbeatRecord.executionAction,
        executionResult,
        readersExecuted,
        errorMessage: heartbeatRecord.errorMessage,
      },
    });
  } catch (error) {
    console.error('[GET /api/admin/timeline/heartbeats/[id]] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get heartbeat details',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
