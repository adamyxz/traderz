import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { positionHistory } from '@/db/schema';
import { eq } from 'drizzle-orm';

/**
 * GET /api/positions/[id]/history
 * 获取仓位历史记录
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const positionId = parseInt(id);

    if (isNaN(positionId)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid position ID',
        },
        { status: 400 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    // 查询历史记录
    const history = await db.query.positionHistory.findMany({
      where: eq(positionHistory.positionId, positionId),
      orderBy: (history, { desc }) => [desc(history.createdAt)],
      limit,
      offset,
    });

    return NextResponse.json({
      success: true,
      data: history,
      count: history.length,
    });
  } catch (error) {
    console.error(`[GET /api/positions/${params}/history] Error:`, error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch position history',
      },
      { status: 500 }
    );
  }
}
