import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/positions/sync-prices
 * 定时任务入口 - 每10秒调用一次
 */
export async function POST(request: NextRequest) {
  try {
    // 内部调用 update-prices API
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/api/positions/update-prices`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    return NextResponse.json({
      success: true,
      data: {
        ...data.data,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[POST /api/positions/sync-prices] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to sync prices',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/positions/sync-prices
 * 获取同步状态
 */
export async function GET(request: NextRequest) {
  return NextResponse.json({
    success: true,
    data: {
      status: 'active',
      interval: 10000, // 10秒
      lastSync: new Date().toISOString(),
    },
  });
}
