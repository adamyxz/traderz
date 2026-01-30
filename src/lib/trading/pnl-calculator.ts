import type { PositionSide } from './position-types';

/**
 * 计算未实现盈亏
 * @param side 仓位方向
 * @param entryPrice 开仓价格
 * @param currentPrice 当前价格
 * @param quantity 数量（基础货币）
 * @returns 未实现盈亏（USDT）
 */
export function calculateUnrealizedPnl(
  side: PositionSide,
  entryPrice: number,
  currentPrice: number,
  quantity: number
): number {
  if (entryPrice <= 0) {
    throw new Error('Entry price must be positive');
  }
  if (currentPrice <= 0) {
    throw new Error('Current price must be positive');
  }
  if (quantity <= 0) {
    throw new Error('Quantity must be positive');
  }

  if (side === 'long') {
    // 做多：(当前价格 - 开仓价格) × 数量
    return (currentPrice - entryPrice) * quantity;
  } else {
    // 做空：(开仓价格 - 当前价格) × 数量
    return (entryPrice - currentPrice) * quantity;
  }
}

/**
 * 计算未实现盈亏百分比
 * @param unrealizedPnl 未实现盈亏（USDT）
 * @param positionSize 仓位大小（USDT）
 * @returns 未实现盈亏百分比
 */
export function calculateUnrealizedPnlPercent(unrealizedPnl: number, positionSize: number): number {
  if (positionSize <= 0) {
    throw new Error('Position size must be positive');
  }

  return (unrealizedPnl / positionSize) * 100;
}

/**
 * 计算回报率（ROE - Return on Equity）
 * @param unrealizedPnl 未实现盈亏（USDT）
 * @param margin 保证金（USDT）
 * @returns 回报率百分比
 */
export function calculateROE(unrealizedPnl: number, margin: number): number {
  if (margin <= 0) {
    throw new Error('Margin must be positive');
  }

  return (unrealizedPnl / margin) * 100;
}

/**
 * 计算已实现盈亏（平仓盈亏）
 * @param side 仓位方向
 * @param entryPrice 开仓价格
 * @param closePrice 平仓价格
 * @param quantity 平仓数量（基础货币）
 * @returns 已实现盈亏（USDT）
 */
export function calculateRealizedPnl(
  side: PositionSide,
  entryPrice: number,
  closePrice: number,
  quantity: number
): number {
  return calculateUnrealizedPnl(side, entryPrice, closePrice, quantity);
}

/**
 * 计算净盈亏（扣除手续费后的盈亏）
 * @param pnl 盈亏（USDT）
 * @param openFee 开仓手续费（USDT）
 * @param closeFee 平仓手续费（USDT）
 * @returns 净盈亏（USDT）
 */
export function calculateNetPnl(pnl: number, openFee: number, closeFee: number): number {
  return pnl - openFee - closeFee;
}

/**
 * 完整的盈亏计算结果
 * @param side 仓位方向
 * @param entryPrice 开仓价格
 * @param currentPrice 当前价格
 * @param quantity 数量（基础货币）
 * @param margin 保证金（USDT）
 * @param positionSize 仓位大小（USDT）
 * @returns 盈亏计算结果
 */
export function calculatePnlMetrics(
  side: PositionSide,
  entryPrice: number,
  currentPrice: number,
  quantity: number,
  margin: number,
  positionSize: number
) {
  const unrealizedPnl = calculateUnrealizedPnl(side, entryPrice, currentPrice, quantity);
  const unrealizedPnlPercent = calculateUnrealizedPnlPercent(unrealizedPnl, positionSize);
  const roe = calculateROE(unrealizedPnl, margin);

  return {
    unrealizedPnl,
    unrealizedPnlPercent,
    roe,
  };
}

/**
 * 判断盈亏状态
 * @param pnl 盈亏（USDT）
 * @returns 盈亏状态
 */
export function getPnlStatus(pnl: number): 'profit' | 'loss' | 'break-even' {
  if (pnl > 0) return 'profit';
  if (pnl < 0) return 'loss';
  return 'break-even';
}

/**
 * 格式化盈亏显示
 * @param pnl 盈亏（USDT）
 * @param showSign 是否显示正负号
 * @returns 格式化的盈亏字符串
 */
export function formatPnl(pnl: number, showSign: boolean = true): string {
  const sign = pnl > 0 && showSign ? '+' : '';
  return `${sign}${pnl.toFixed(2)} USDT`;
}
