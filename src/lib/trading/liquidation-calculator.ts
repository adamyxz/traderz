import { RISK_LIMITS } from './position-types';
import type { PositionSide } from './position-types';

/**
 * 计算爆仓价格
 * @param side 仓位方向
 * @param entryPrice 开仓价格
 * @param leverage 杠杆倍数
 * @param maintenanceMarginRatio 维持保证金率，默认0.5%
 * @returns 爆仓价格
 */
export function calculateLiquidationPrice(
  side: PositionSide,
  entryPrice: number,
  leverage: number,
  maintenanceMarginRatio: number = RISK_LIMITS.MAINTENANCE_MARGIN_RATIO
): number {
  if (entryPrice <= 0) {
    throw new Error('Entry price must be positive');
  }
  if (leverage <= 0) {
    throw new Error('Leverage must be positive');
  }
  if (maintenanceMarginRatio < 0 || maintenanceMarginRatio > 1) {
    throw new Error('Maintenance margin ratio must be between 0 and 1');
  }

  if (side === 'long') {
    // 做多爆仓价 = 开仓价 × (1 - 1/杠杆倍数 + 维持保证金率)
    return entryPrice * (1 - 1 / leverage + maintenanceMarginRatio);
  } else {
    // 做空爆仓价 = 开仓价 × (1 + 1/杠杆倍数 - 维持保证金率)
    return entryPrice * (1 + 1 / leverage - maintenanceMarginRatio);
  }
}

/**
 * 计算距离爆仓的价格缓冲
 * @param side 仓位方向
 * @param currentPrice 当前价格
 * @param liquidationPrice 爆仓价格
 * @returns 价格缓冲（绝对值）
 */
export function calculatePriceBuffer(
  side: PositionSide,
  currentPrice: number,
  liquidationPrice: number
): number {
  if (side === 'long') {
    // 做多：当前价 - 爆仓价
    return currentPrice - liquidationPrice;
  } else {
    // 做空：爆仓价 - 当前价
    return liquidationPrice - currentPrice;
  }
}

/**
 * 计算距离爆仓的百分比
 * @param priceBuffer 价格缓冲（绝对值）
 * @param currentPrice 当前价格
 * @returns 百分比
 */
export function calculateLiquidationMarginPercent(
  priceBuffer: number,
  currentPrice: number
): number {
  if (currentPrice <= 0) {
    throw new Error('Current price must be positive');
  }

  return (priceBuffer / currentPrice) * 100;
}

/**
 * 判断是否接近爆仓
 * @param priceBuffer 价格缓冲（绝对值）
 * @param currentPrice 当前价格
 * @param threshold 阈值百分比，默认10%
 * @returns 是否接近爆仓
 */
export function isNearLiquidation(
  priceBuffer: number,
  currentPrice: number,
  threshold: number = 10
): boolean {
  const marginPercent = calculateLiquidationMarginPercent(priceBuffer, currentPrice);
  return marginPercent < threshold;
}

/**
 * 计算爆仓风险等级
 * @param priceBuffer 价格缓冲（绝对值）
 * @param currentPrice 当前价格
 * @returns 风险等级
 */
export function getLiquidationRiskLevel(
  priceBuffer: number,
  currentPrice: number
): 'low' | 'medium' | 'high' | 'critical' {
  const marginPercent = calculateLiquidationMarginPercent(priceBuffer, currentPrice);

  if (marginPercent < 2) return 'critical';
  if (marginPercent < 5) return 'high';
  if (marginPercent < 10) return 'medium';
  return 'low';
}

/**
 * 判断是否应该爆仓
 * @param side 仓位方向
 * @param currentPrice 当前价格
 * @param liquidationPrice 爆仓价格
 * @returns 是否应该爆仓
 */
export function shouldLiquidate(
  side: PositionSide,
  currentPrice: number,
  liquidationPrice: number
): boolean {
  if (side === 'long') {
    // 做多：当前价 <= 爆仓价
    return currentPrice <= liquidationPrice;
  } else {
    // 做空：当前价 >= 爆仓价
    return currentPrice >= liquidationPrice;
  }
}

/**
 * 计算在特定价格下的盈亏百分比（用于判断爆仓）
 * @param side 仓位方向
 * @param targetPrice 目标价格
 * @param entryPrice 开仓价格
 * @param leverage 杠杆倍数
 * @returns 盈亏百分比
 */
export function calculatePnlPercentAtPrice(
  side: PositionSide,
  targetPrice: number,
  entryPrice: number,
  leverage: number
): number {
  let priceChangePercent: number;

  if (side === 'long') {
    // 做多盈亏百分比 = (目标价 - 开仓价) / 开仓价 × 杠杆 × 100
    priceChangePercent = ((targetPrice - entryPrice) / entryPrice) * leverage * 100;
  } else {
    // 做空盈亏百分比 = (开仓价 - 目标价) / 开仓价 × 杠杆 × 100
    priceChangePercent = ((entryPrice - targetPrice) / entryPrice) * leverage * 100;
  }

  return priceChangePercent;
}

/**
 * 格式化爆仓风险信息
 * @param riskLevel 风险等级
 * @param marginPercent 距离爆仓的百分比
 * @returns 格式化的风险信息
 */
export function formatLiquidationRisk(riskLevel: string, marginPercent: number): string {
  const emojiMap = {
    low: '🟢',
    medium: '🟡',
    high: '🟠',
    critical: '🔴',
  };

  const emoji = emojiMap[riskLevel as keyof typeof emojiMap] || '⚪';
  return `${emoji} ${riskLevel.toUpperCase()} - ${marginPercent.toFixed(2)}% from liquidation`;
}
