import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { positions, tradingPairs, traders, positionHistory } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { binanceClient } from '@/lib/trading/binance-client';
import { calculateMargin, calculateQuantity } from '@/lib/trading/margin-calculator';
import { calculateOpenFee } from '@/lib/trading/fee-calculator';
import { calculateLiquidationPrice } from '@/lib/trading/liquidation-calculator';
import type { CreatePositionRequest } from '@/lib/trading/position-types';

/**
 * GET /api/positions
 * 获取持仓列表
 * Query params:
 * - traderId: 交易员ID（可选）
 * - status: 仓位状态（可选，'open', 'closed', 'liquidated'）
 * - tradingPairId: 交易对ID（可选）
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const traderId = searchParams.get('traderId');
    const status = searchParams.get('status');
    const tradingPairId = searchParams.get('tradingPairId');

    // 构建查询条件
    const conditions = [];

    if (traderId) {
      conditions.push(eq(positions.traderId, parseInt(traderId)));
    }

    if (status) {
      conditions.push(eq(positions.status, status as 'open' | 'closed' | 'liquidated'));
    }

    if (tradingPairId) {
      conditions.push(eq(positions.tradingPairId, parseInt(tradingPairId)));
    }

    // 查询持仓
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const positionList = await db
      .select({
        position: positions,
        trader: {
          id: traders.id,
          name: traders.name,
        },
        tradingPair: {
          id: tradingPairs.id,
          symbol: tradingPairs.symbol,
        },
      })
      .from(positions)
      .leftJoin(traders, eq(positions.traderId, traders.id))
      .leftJoin(tradingPairs, eq(positions.tradingPairId, tradingPairs.id))
      .where(whereClause)
      .orderBy(desc(positions.openedAt));

    return NextResponse.json({
      success: true,
      data: positionList,
      count: positionList.length,
    });
  } catch (error) {
    console.error('[GET /api/positions] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch positions',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/positions
 * 开仓
 */
export async function POST(request: NextRequest) {
  try {
    const body: CreatePositionRequest = await request.json();

    // 验证请求体
    if (
      !body.traderId ||
      !body.tradingPairId ||
      !body.side ||
      !body.leverage ||
      !body.positionSize
    ) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: traderId, tradingPairId, side, leverage, positionSize',
        },
        { status: 400 }
      );
    }

    // 验证交易员是否存在
    const trader = await db.query.traders.findFirst({
      where: eq(traders.id, body.traderId),
    });

    if (!trader) {
      return NextResponse.json(
        {
          success: false,
          error: `Trader with id ${body.traderId} not found`,
        },
        { status: 404 }
      );
    }

    // 验证交易对是否存在
    const tradingPair = await db.query.tradingPairs.findFirst({
      where: eq(tradingPairs.id, body.tradingPairId),
    });

    if (!tradingPair) {
      return NextResponse.json(
        {
          success: false,
          error: `Trading pair with id ${body.tradingPairId} not found`,
        },
        { status: 404 }
      );
    }

    // 验证杠杆是否在交易员允许范围内
    const maxLeverage = parseFloat(trader.maxLeverage);
    const minLeverage = parseFloat(trader.minLeverage);

    if (body.leverage < minLeverage || body.leverage > maxLeverage) {
      return NextResponse.json(
        {
          success: false,
          error: `Leverage must be between ${minLeverage} and ${maxLeverage}`,
        },
        { status: 400 }
      );
    }

    // 验证仓位大小是否在交易员限制内
    const maxPositionSize = parseFloat(trader.maxPositionSize);
    if (body.positionSize > maxPositionSize) {
      return NextResponse.json(
        {
          success: false,
          error: `Position size cannot exceed ${maxPositionSize} USDT`,
        },
        { status: 400 }
      );
    }

    // 验证做空权限
    if (body.side === 'short' && !trader.allowShort) {
      return NextResponse.json(
        {
          success: false,
          error: 'Trader does not allow short positions',
        },
        { status: 400 }
      );
    }

    // 获取当前价格（如果未提供）
    const entryPrice = body.entryPrice || (await binanceClient.getPrice(tradingPair.symbol));

    // 计算保证金和数量
    const margin = calculateMargin(body.positionSize, body.leverage);
    const quantity = calculateQuantity(body.positionSize, entryPrice);

    // 计算开仓手续费
    const openFee = calculateOpenFee(body.positionSize);

    // 计算爆仓价格
    const liquidationPrice = calculateLiquidationPrice(body.side, entryPrice, body.leverage);

    // 验证止盈止损价格
    if (body.stopLossPrice && body.takeProfitPrice) {
      if (body.side === 'long') {
        if (!(body.stopLossPrice < entryPrice && entryPrice < body.takeProfitPrice)) {
          return NextResponse.json(
            {
              success: false,
              error: 'For long positions: stop loss < entry < take profit',
            },
            { status: 400 }
          );
        }
      } else {
        if (!(body.takeProfitPrice < entryPrice && entryPrice < body.stopLossPrice)) {
          return NextResponse.json(
            {
              success: false,
              error: 'For short positions: take profit < entry < stop loss',
            },
            { status: 400 }
          );
        }
      }
    }

    // 创建仓位
    const [newPosition] = await db
      .insert(positions)
      .values({
        traderId: body.traderId,
        tradingPairId: body.tradingPairId,
        side: body.side,
        status: 'open',
        entryPrice: entryPrice.toString(),
        currentPrice: entryPrice.toString(),
        leverage: body.leverage.toString(),
        quantity: quantity.toString(),
        positionSize: body.positionSize.toString(),
        margin: margin.toString(),
        openFee: openFee.toString(),
        closeFee: '0',
        unrealizedPnl: '0',
        realizedPnl: '0',
        stopLossPrice: body.stopLossPrice?.toString() || null,
        takeProfitPrice: body.takeProfitPrice?.toString() || null,
        openedAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    // 记录历史
    await db.insert(positionHistory).values({
      positionId: newPosition.id,
      action: 'open',
      price: entryPrice.toString(),
      quantity: quantity.toString(),
      pnl: '0',
      fee: openFee.toString(),
      metadata: JSON.stringify({
        leverage: body.leverage,
        liquidationPrice,
      }),
      createdAt: new Date(),
    });

    return NextResponse.json({
      success: true,
      data: {
        ...newPosition,
        liquidationPrice,
      },
    });
  } catch (error) {
    console.error('[POST /api/positions] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create position',
      },
      { status: 500 }
    );
  }
}
