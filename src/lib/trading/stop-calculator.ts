import type { PositionSide } from './position-types';

/**
 * 计算止损价格
 * @param side 仓位方向
 * @param entryPrice 开仓价格
 * @param stopLossPercent 止损百分比（如 5 表示 5%）
 * @returns 止损价格
 */
export function calculateStopLossPrice(
  side: PositionSide,
  entryPrice: number,
  stopLossPercent: number
): number {
  if (entryPrice <= 0) {
    throw new Error('Entry price must be positive');
  }
  if (stopLossPercent < 0 || stopLossPercent > 100) {
    throw new Error('Stop loss percent must be between 0 and 100');
  }

  if (side === 'long') {
    // 做多止损价 = 开仓价 × (1 - 止损百分比)
    return entryPrice * (1 - stopLossPercent / 100);
  } else {
    // 做空止损价 = 开仓价 × (1 + 止损百分比)
    return entryPrice * (1 + stopLossPercent / 100);
  }
}

/**
 * 计算止盈价格
 * @param side 仓位方向
 * @param entryPrice 开仓价格
 * @param takeProfitPercent 止盈百分比（如 10 表示 10%）
 * @returns 止盈价格
 */
export function calculateTakeProfitPrice(
  side: PositionSide,
  entryPrice: number,
  takeProfitPercent: number
): number {
  if (entryPrice <= 0) {
    throw new Error('Entry price must be positive');
  }
  if (takeProfitPercent < 0) {
    throw new Error('Take profit percent must be positive');
  }

  if (side === 'long') {
    // 做多止盈价 = 开仓价 × (1 + 止盈百分比)
    return entryPrice * (1 + takeProfitPercent / 100);
  } else {
    // 做空止盈价 = 开仓价 × (1 - 止盈百分比)
    return entryPrice * (1 - takeProfitPercent / 100);
  }
}

/**
 * 判断是否触发止损
 * @param side 仓位方向
 * @param currentPrice 当前价格
 * @param stopLossPrice 止损价格
 * @returns 是否触发止损
 */
export function isStopLossTriggered(
  side: PositionSide,
  currentPrice: number,
  stopLossPrice: number
): boolean {
  if (side === 'long') {
    // 做多：当前价 <= 止损价
    return currentPrice <= stopLossPrice;
  } else {
    // 做空：当前价 >= 止损价
    return currentPrice >= stopLossPrice;
  }
}

/**
 * 判断是否触发止盈
 * @param side 仓位方向
 * @param currentPrice 当前价格
 * @param takeProfitPrice 止盈价格
 * @returns 是否触发止盈
 */
export function isTakeProfitTriggered(
  side: PositionSide,
  currentPrice: number,
  takeProfitPrice: number
): boolean {
  if (side === 'long') {
    // 做多：当前价 >= 止盈价
    return currentPrice >= takeProfitPrice;
  } else {
    // 做空：当前价 <= 止盈价
    return currentPrice <= takeProfitPrice;
  }
}

/**
 * 计算止损盈亏百分比
 * @param side 仓位方向
 * @param stopLossPrice 止损价格
 * @param entryPrice 开仓价格
 * @returns 盈亏百分比（负数）
 */
export function calculateStopLossPnlPercent(
  side: PositionSide,
  stopLossPrice: number,
  entryPrice: number
): number {
  if (side === 'long') {
    // 做多
    return ((stopLossPrice - entryPrice) / entryPrice) * 100;
  } else {
    // 做空
    return ((entryPrice - stopLossPrice) / entryPrice) * 100;
  }
}

/**
 * 计算止盈盈亏百分比
 * @param side 仓位方向
 * @param takeProfitPrice 止盈价格
 * @param entryPrice 开仓价格
 * @returns 盈亏百分比（正数）
 */
export function calculateTakeProfitPnlPercent(
  side: PositionSide,
  takeProfitPrice: number,
  entryPrice: number
): number {
  if (side === 'long') {
    // 做多
    return ((takeProfitPrice - entryPrice) / entryPrice) * 100;
  } else {
    // 做空
    return ((entryPrice - takeProfitPrice) / entryPrice) * 100;
  }
}

/**
 * 计算风险回报比
 * @param entryPrice 开仓价格
 * @param stopLossPrice 止损价格
 * @param takeProfitPrice 止盈价格
 * @returns 风险回报比
 */
export function calculateRiskRewardRatio(
  entryPrice: number,
  stopLossPrice: number,
  takeProfitPrice: number
): number {
  const risk = Math.abs(entryPrice - stopLossPrice);
  const reward = Math.abs(takeProfitPrice - entryPrice);

  if (risk === 0) {
    throw new Error('Risk (distance to stop loss) cannot be zero');
  }

  return reward / risk;
}

/**
 * 验证止损止盈价格是否合理
 * @param side 仓位方向
 * @param entryPrice 开仓价格
 * @param stopLossPrice 止损价格
 * @param takeProfitPrice 止盈价格
 * @returns 是否合理
 */
export function validateStopPrices(
  side: PositionSide,
  entryPrice: number,
  stopLossPrice?: number,
  takeProfitPrice?: number
): { valid: boolean; error?: string } {
  if (stopLossPrice !== undefined && takeProfitPrice !== undefined) {
    if (side === 'long') {
      // 做多：止损价 < 开仓价 < 止盈价
      if (!(stopLossPrice < entryPrice && entryPrice < takeProfitPrice)) {
        return {
          valid: false,
          error: 'For long positions: stop loss < entry < take profit',
        };
      }
    } else {
      // 做空：止盈价 < 开仓价 < 止损价
      if (!(takeProfitPrice < entryPrice && entryPrice < stopLossPrice)) {
        return {
          valid: false,
          error: 'For short positions: take profit < entry < stop loss',
        };
      }
    }
  }

  return { valid: true };
}

/**
 * 格式化止损止盈信息
 * @param stopLossPrice 止损价格
 * @param takeProfitPrice 止盈价格
 * @param entryPrice 开仓价格
 * @returns 格式化的信息
 */
export function formatStopPrices(
  stopLossPrice: number | undefined,
  takeProfitPrice: number | undefined,
  entryPrice: number
): string {
  const parts: string[] = [];

  if (stopLossPrice !== undefined) {
    const stopLossPercent = Math.abs((stopLossPrice - entryPrice) / entryPrice) * 100;
    parts.push(`Stop Loss: ${stopLossPrice.toFixed(2)} (-${stopLossPercent.toFixed(2)}%)`);
  }

  if (takeProfitPrice !== undefined) {
    const takeProfitPercent = Math.abs((takeProfitPrice - entryPrice) / entryPrice) * 100;
    parts.push(`Take Profit: ${takeProfitPrice.toFixed(2)} (+${takeProfitPercent.toFixed(2)}%)`);
  }

  return parts.join(' | ');
}
