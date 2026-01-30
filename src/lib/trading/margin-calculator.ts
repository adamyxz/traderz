import { RISK_LIMITS } from './position-types';

/**
 * 计算保证金
 * @param positionSize 仓位大小（USDT）
 * @param leverage 杠杆倍数
 * @returns 保证金（USDT）
 */
export function calculateMargin(positionSize: number, leverage: number): number {
  if (positionSize <= 0) {
    throw new Error('Position size must be positive');
  }
  if (leverage < RISK_LIMITS.MIN_LEVERAGE || leverage > RISK_LIMITS.MAX_LEVERAGE) {
    throw new Error(
      `Leverage must be between ${RISK_LIMITS.MIN_LEVERAGE} and ${RISK_LIMITS.MAX_LEVERAGE}`
    );
  }

  return positionSize / leverage;
}

/**
 * 计算数量（基础货币）
 * @param positionSize 仓位大小（USDT）
 * @param price 价格
 * @returns 数量（基础货币）
 */
export function calculateQuantity(positionSize: number, price: number): number {
  if (positionSize <= 0) {
    throw new Error('Position size must be positive');
  }
  if (price <= 0) {
    throw new Error('Price must be positive');
  }

  return positionSize / price;
}

/**
 * 计算仓位大小（USDT）
 * @param quantity 数量（基础货币）
 * @param price 价格
 * @returns 仓位大小（USDT）
 */
export function calculatePositionSize(quantity: number, price: number): number {
  if (quantity <= 0) {
    throw new Error('Quantity must be positive');
  }
  if (price <= 0) {
    throw new Error('Price must be positive');
  }

  return quantity * price;
}

/**
 * 根据保证金和杠杆计算最大仓位大小
 * @param margin 保证金（USDT）
 * @param leverage 杠杆倍数
 * @returns 最大仓位大小（USDT）
 */
export function calculateMaxPositionSize(margin: number, leverage: number): number {
  if (margin <= 0) {
    throw new Error('Margin must be positive');
  }
  if (leverage < RISK_LIMITS.MIN_LEVERAGE || leverage > RISK_LIMITS.MAX_LEVERAGE) {
    throw new Error(
      `Leverage must be between ${RISK_LIMITS.MIN_LEVERAGE} and ${RISK_LIMITS.MAX_LEVERAGE}`
    );
  }

  return margin * leverage;
}

/**
 * 验证仓位大小是否符合限制
 * @param positionSize 仓位大小（USDT）
 * @returns 是否有效
 */
export function validatePositionSize(positionSize: number): boolean {
  return (
    positionSize >= RISK_LIMITS.MIN_POSITION_SIZE && positionSize <= RISK_LIMITS.MAX_POSITION_SIZE
  );
}

/**
 * 获取仓位大小错误信息
 * @param positionSize 仓位大小（USDT）
 * @returns 错误信息或null
 */
export function getPositionSizeError(positionSize: number): string | null {
  if (positionSize < RISK_LIMITS.MIN_POSITION_SIZE) {
    return `Position size must be at least ${RISK_LIMITS.MIN_POSITION_SIZE} USDT`;
  }
  if (positionSize > RISK_LIMITS.MAX_POSITION_SIZE) {
    return `Position size cannot exceed ${RISK_LIMITS.MAX_POSITION_SIZE} USDT`;
  }
  return null;
}
