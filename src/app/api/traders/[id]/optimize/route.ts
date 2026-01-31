import { NextRequest, NextResponse } from 'next/server';
import { executeOptimization, getOptimizationHistory } from '@/lib/optimization/executor';

/**
 * POST /api/traders/[id]/optimize
 * Trigger optimization for a specific trader
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const traderId = parseInt(id, 10);

    if (isNaN(traderId)) {
      return NextResponse.json({ error: 'Invalid trader ID' }, { status: 400 });
    }

    // Parse request body
    const body = await request.json().catch(() => ({}));
    const force = body.force === true;

    // Execute optimization
    const result = await executeOptimization({ traderId, force });

    if (result.success) {
      return NextResponse.json({
        success: true,
        data: result.data,
        optimizationId: result.optimizationId,
      });
    } else {
      return NextResponse.json(
        { error: result.error },
        { status: result.error?.includes('Insufficient data') ? 400 : 500 }
      );
    }
  } catch (error) {
    console.error('[API] Optimization error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/traders/[id]/optimize
 * Get optimization history for a specific trader
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const traderId = parseInt(id, 10);

    if (isNaN(traderId)) {
      return NextResponse.json({ error: 'Invalid trader ID' }, { status: 400 });
    }

    // Get limit from query params
    const searchParams = request.nextUrl.searchParams;
    const limit = searchParams.get('limit');
    const limitNum = limit ? parseInt(limit, 10) : 20;

    // Get optimization history
    const history = await getOptimizationHistory({ traderId, limit: limitNum });

    return NextResponse.json({
      success: true,
      data: history,
    });
  } catch (error) {
    console.error('[API] Error fetching optimization history:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
