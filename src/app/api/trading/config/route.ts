import { NextResponse } from 'next/server';
import { db } from '@/db';
import { systemConfigurations } from '@/db/schema';
import { eq } from 'drizzle-orm';

const CONFIG_KEY = 'trading_layout_config';

// 配置接口
export interface TradingLayoutConfig {
  layout: '1x1' | '2x1' | '1x2' | '2x2';
  charts: Array<{
    id: string;
    symbol: string;
    interval: string;
    isRunning: boolean;
  }>;
}

// GET /api/trading/config - 获取配置
export async function GET() {
  try {
    const configs = await db
      .select()
      .from(systemConfigurations)
      .where(eq(systemConfigurations.key, CONFIG_KEY))
      .limit(1);

    if (configs.length === 0) {
      // 返回默认配置
      const defaultConfig: TradingLayoutConfig = {
        layout: '1x1',
        charts: [
          {
            id: 'chart-1',
            symbol: 'BTCUSDT',
            interval: '1m',
            isRunning: true,
          },
        ],
      };
      return NextResponse.json(defaultConfig);
    }

    const config = JSON.parse(configs[0].value) as TradingLayoutConfig;
    return NextResponse.json(config);
  } catch (error) {
    console.error('Error fetching trading config:', error);
    return NextResponse.json({ error: 'Failed to fetch trading config' }, { status: 500 });
  }
}

// PUT /api/trading/config - 保存配置
export async function PUT(request: Request) {
  try {
    const body: TradingLayoutConfig = await request.json();

    // 验证配置
    if (!body.layout || !body.charts || !Array.isArray(body.charts)) {
      return NextResponse.json({ error: 'Invalid configuration format' }, { status: 400 });
    }

    const validLayouts = ['1x1', '2x1', '1x2', '2x2'];
    if (!validLayouts.includes(body.layout)) {
      return NextResponse.json({ error: 'Invalid layout type' }, { status: 400 });
    }

    // 检查是否已存在配置
    const existing = await db
      .select()
      .from(systemConfigurations)
      .where(eq(systemConfigurations.key, CONFIG_KEY))
      .limit(1);

    const value = JSON.stringify(body);
    const now = new Date();

    if (existing.length > 0) {
      // 更新现有配置
      await db
        .update(systemConfigurations)
        .set({
          value,
          updatedAt: now,
        })
        .where(eq(systemConfigurations.key, CONFIG_KEY));
    } else {
      // 创建新配置
      await db.insert(systemConfigurations).values({
        key: CONFIG_KEY,
        value,
        description: 'Trading page multi-chart layout configuration',
        createdAt: now,
        updatedAt: now,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving trading config:', error);
    return NextResponse.json({ error: 'Failed to save trading config' }, { status: 500 });
  }
}
