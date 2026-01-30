import { NextRequest, NextResponse } from 'next/server';
import { syncReadersFromDirectory } from '@/lib/readers/sync';
import { db } from '@/db';

// POST - 同步readers
export async function POST(_request: NextRequest) {
  try {
    const result = await syncReadersFromDirectory({
      readersDirectory: '/Users/yxz/dev/traderz/readers',
      db,
    });

    return NextResponse.json({
      success: true,
      message: `Synced ${result.synced} readers (created: ${result.created}, updated: ${result.updated}, skipped: ${result.skipped})`,
      details: result,
    });
  } catch (error) {
    console.error('Error syncing readers:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Sync failed',
      },
      { status: 500 }
    );
  }
}
