import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { positions, tradingPairs, positionHistory, priceCache } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { binanceClient } from '@/lib/trading/binance-client';
import { calculatePnlMetrics } from '@/lib/trading/pnl-calculator';
import { calculateLiquidationPrice, shouldLiquidate } from '@/lib/trading/liquidation-calculator';
import {
  isStopLossTriggered as checkStopLoss,
  isTakeProfitTriggered as checkTakeProfit,
} from '@/lib/trading/stop-calculator';

/**
 * POST /api/positions/update-prices
 * 批量更新所有持仓的价格和未实现盈亏
 */
export async function POST(request: NextRequest) {
  try {
    const startTime = Date.now();

    // 获取所有开仓的持仓
    const openPositions = await db.select().from(positions).where(eq(positions.status, 'open'));

    if (openPositions.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          updated: 0,
          liquidated: 0,
          stopLossTriggered: 0,
          takeProfitTriggered: 0,
          duration: Date.now() - startTime,
        },
      });
    }

    // 获取所有需要的交易对
    const tradingPairIds = [...new Set(openPositions.map((p) => p.tradingPairId))];
    const tradingPairsData = await db.query.tradingPairs.findMany({
      where: (tradingPair, { inArray }) => inArray(tradingPair.id, tradingPairIds),
    });

    const symbolToPairIdMap = new Map(tradingPairsData.map((pair) => [pair.symbol, pair.id]));

    // 批量获取所有交易对的价格
    const allPrices = await binanceClient.getAllPrices();

    let updatedCount = 0;
    let liquidatedCount = 0;
    let stopLossTriggeredCount = 0;
    let takeProfitTriggeredCount = 0;

    // 批量更新持仓
    for (const position of openPositions) {
      const tradingPair = tradingPairsData.find((pair) => pair.id === position.tradingPairId);

      if (!tradingPair) {
        console.error(`Trading pair not found for position ${position.id}`);
        continue;
      }

      const currentPrice = allPrices.get(tradingPair.symbol);

      if (currentPrice === undefined) {
        console.error(`Price not found for ${tradingPair.symbol}`);
        continue;
      }

      const entryPrice = parseFloat(position.entryPrice);
      const quantity = parseFloat(position.quantity);
      const margin = parseFloat(position.margin);
      const positionSize = parseFloat(position.positionSize);
      const leverage = parseFloat(position.leverage);
      const side = position.side;

      // 计算未实现盈亏
      const pnlMetrics = calculatePnlMetrics(
        side,
        entryPrice,
        currentPrice,
        quantity,
        margin,
        positionSize
      );

      // 更新价格和未实现盈亏
      await db
        .update(positions)
        .set({
          currentPrice: currentPrice.toString(),
          unrealizedPnl: pnlMetrics.unrealizedPnl.toString(),
          updatedAt: new Date(),
        })
        .where(eq(positions.id, position.id));

      // 记录价格更新历史
      await db.insert(positionHistory).values({
        positionId: position.id,
        action: 'price_update',
        price: currentPrice.toString(),
        pnl: pnlMetrics.unrealizedPnl.toString(),
        metadata: JSON.stringify({
          unrealizedPnlPercent: pnlMetrics.unrealizedPnlPercent,
          roe: pnlMetrics.roe,
        }),
        createdAt: new Date(),
      });

      // 更新价格缓存
      await db
        .insert(priceCache)
        .values({
          tradingPairId: tradingPair.id,
          price: currentPrice.toString(),
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: priceCache.tradingPairId,
          set: {
            price: currentPrice.toString(),
            updatedAt: new Date(),
          },
        });

      // 检查爆仓
      const liquidationPrice = calculateLiquidationPrice(side, entryPrice, leverage);
      if (shouldLiquidate(side, currentPrice, liquidationPrice)) {
        // 触发爆仓
        await db
          .update(positions)
          .set({
            status: 'liquidated',
            currentPrice: currentPrice.toString(),
            closedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(positions.id, position.id));

        await db.insert(positionHistory).values({
          positionId: position.id,
          action: 'liquidate',
          price: currentPrice.toString(),
          quantity: quantity.toString(),
          pnl: pnlMetrics.unrealizedPnl.toString(),
          metadata: JSON.stringify({
            liquidationPrice,
          }),
          createdAt: new Date(),
        });

        liquidatedCount++;
        continue;
      }

      // 检查止损
      if (position.stopLossPrice) {
        const stopLossPrice = parseFloat(position.stopLossPrice);
        if (checkStopLoss(side, currentPrice, stopLossPrice)) {
          // 触发止损平仓
          await db
            .update(positions)
            .set({
              status: 'closed',
              currentPrice: currentPrice.toString(),
              closedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(positions.id, position.id));

          await db.insert(positionHistory).values({
            positionId: position.id,
            action: 'stop_loss_triggered',
            price: currentPrice.toString(),
            quantity: quantity.toString(),
            pnl: pnlMetrics.unrealizedPnl.toString(),
            createdAt: new Date(),
          });

          stopLossTriggeredCount++;
          continue;
        }
      }

      // 检查止盈
      if (position.takeProfitPrice) {
        const takeProfitPrice = parseFloat(position.takeProfitPrice);
        if (checkTakeProfit(side, currentPrice, takeProfitPrice)) {
          // 触发止盈平仓
          await db
            .update(positions)
            .set({
              status: 'closed',
              currentPrice: currentPrice.toString(),
              closedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(positions.id, position.id));

          await db.insert(positionHistory).values({
            positionId: position.id,
            action: 'take_profit_triggered',
            price: currentPrice.toString(),
            quantity: quantity.toString(),
            pnl: pnlMetrics.unrealizedPnl.toString(),
            createdAt: new Date(),
          });

          takeProfitTriggeredCount++;
          continue;
        }
      }

      updatedCount++;
    }

    return NextResponse.json({
      success: true,
      data: {
        updated: updatedCount,
        liquidated: liquidatedCount,
        stopLossTriggered: stopLossTriggeredCount,
        takeProfitTriggered: takeProfitTriggeredCount,
        duration: Date.now() - startTime,
      },
    });
  } catch (error) {
    console.error('[POST /api/positions/update-prices] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update prices',
      },
      { status: 500 }
    );
  }
}
