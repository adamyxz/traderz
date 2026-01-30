import { FEE_RATE } from './position-types';

/**
 * 计算开仓手续费
 * @param positionSize 仓位大小（USDT）
 * @param feeRate 费率，默认使用平均费率
 * @returns 手续费（USDT）
 */
export function calculateOpenFee(positionSize: number, feeRate: number = FEE_RATE.AVERAGE): number {
  if (positionSize <= 0) {
    throw new Error('Position size must be positive');
  }
  if (feeRate < 0 || feeRate > 1) {
    throw new Error('Fee rate must be between 0 and 1');
  }

  return positionSize * feeRate;
}

/**
 * 计算平仓手续费
 * @param positionSize 仓位大小（USDT）
 * @param feeRate 费率，默认使用平均费率
 * @returns 手续费（USDT）
 */
export function calculateCloseFee(
  positionSize: number,
  feeRate: number = FEE_RATE.AVERAGE
): number {
  return calculateOpenFee(positionSize, feeRate);
}

/**
 * 计算部分平仓手续费
 * @param fullPositionSize 完整仓位大小（USDT）
 * @param closeQuantity 平仓数量（基础货币）
 * @param currentPrice 当前价格
 * @param feeRate 费率，默认使用平均费率
 * @returns 手续费（USDT）
 */
export function calculatePartialCloseFee(
  fullPositionSize: number,
  closeQuantity: number,
  currentPrice: number,
  feeRate: number = FEE_RATE.AVERAGE
): number {
  if (closeQuantity <= 0) {
    throw new Error('Close quantity must be positive');
  }
  if (currentPrice <= 0) {
    throw new Error('Current price must be positive');
  }

  const closeSize = closeQuantity * currentPrice;
  return closeSize * feeRate;
}

/**
 * 计算总手续费（开仓+平仓）
 * @param positionSize 仓位大小（USDT）
 * @param feeRate 费率，默认使用平均费率
 * @returns 总手续费（USDT）
 */
export function calculateTotalFee(
  positionSize: number,
  feeRate: number = FEE_RATE.AVERAGE
): number {
  return calculateOpenFee(positionSize, feeRate) + calculateCloseFee(positionSize, feeRate);
}

/**
 * 格式化手续费显示
 * @param fee 手续费（USDT）
 * @param positionSize 仓位大小（USDT）
 * @returns 格式化的手续费字符串
 */
export function formatFeeDisplay(fee: number, positionSize: number): string {
  const feePercent = (fee / positionSize) * 100;
  return `${fee.toFixed(2)} USDT (${feePercent.toFixed(4)}%)`;
}
