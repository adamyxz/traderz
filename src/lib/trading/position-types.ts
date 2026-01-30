/**
 * 仓位系统类型定义
 */

/**
 * 仓位方向
 */
export type PositionSide = 'long' | 'short';

/**
 * 仓位状态
 */
export type PositionStatus = 'open' | 'closed' | 'liquidated';

/**
 * 历史记录操作类型
 */
export type HistoryAction =
  | 'open'
  | 'close'
  | 'liquidate'
  | 'price_update'
  | 'stop_loss_triggered'
  | 'take_profit_triggered'
  | 'margin_added'
  | 'margin_removed';

/**
 * 仓位数据（从数据库）
 */
export interface Position {
  id: number;
  traderId: number;
  tradingPairId: number;
  side: PositionSide;
  status: PositionStatus;
  entryPrice: string;
  currentPrice: string;
  leverage: string;
  quantity: string;
  positionSize: string;
  margin: string;
  openFee: string;
  closeFee: string;
  unrealizedPnl: string;
  realizedPnl: string;
  stopLossPrice: string | null;
  takeProfitPrice: string | null;
  openedAt: Date;
  closedAt: Date | null;
  updatedAt: Date;
}

/**
 * 创建仓位请求
 */
export interface CreatePositionRequest {
  traderId: number;
  tradingPairId: number;
  side: PositionSide;
  leverage: number;
  positionSize: number; // USDT
  entryPrice?: number; // 如果不提供，会从API获取当前价格
  stopLossPrice?: number;
  takeProfitPrice?: number;
}

/**
 * 仓位计算结果
 */
export interface PositionCalculation {
  quantity: number; // 数量（基础货币）
  margin: number; // 保证金（USDT）
  openFee: number; // 开仓手续费
  liquidationPrice: number; // 爆仓价格
}

/**
 * 盈亏计算结果
 */
export interface PnlCalculation {
  unrealizedPnl: number; // 未实现盈亏
  unrealizedPnlPercent: number; // 未实现盈亏百分比
  roe: number; // 回报率（Return on Equity）
}

/**
 * 价格数据
 */
export interface PriceData {
  symbol: string;
  price: number;
  priceChange24h?: number;
  priceChangePercent24h?: number;
}

/**
 * 平仓请求
 */
export interface ClosePositionRequest {
  quantity?: number; // 部分平仓数量（可选），不提供则全部平仓
  closePrice?: number; // 平仓价格（可选），如果不提供会从API获取当前价格
}

/**
 * 平仓结果
 */
export interface ClosePositionResult {
  closePrice: number;
  closeFee: number;
  realizedPnl: number;
  totalPnl: number; // 包含手续费的净盈亏
  remainingQuantity: number; // 剩余数量（部分平仓时）
  isFullyClosed: boolean;
}

/**
 * 仓位历史记录
 */
export interface PositionHistoryRecord {
  id: number;
  positionId: number;
  action: HistoryAction;
  price: string | null;
  quantity: string | null;
  pnl: string | null;
  fee: string | null;
  metadata: string | null;
  createdAt: Date;
}

/**
 * 价格缓存数据
 */
export interface PriceCacheData {
  id: number;
  tradingPairId: number;
  price: string;
  priceChange24h: string | null;
  priceChangePercent24h: string | null;
  updatedAt: Date;
}

/**
 * 手续费率配置
 */
export const FEE_RATE = {
  MAKER: 0.0002, // 0.02%
  TAKER: 0.0004, // 0.04%
  AVERAGE: 0.0005, // 0.05% (平均)
} as const;

/**
 * 风险限制配置
 */
export const RISK_LIMITS = {
  MAX_LEVERAGE: 125, // 最大杠杆
  MIN_LEVERAGE: 1, // 最小杠杆
  MAX_POSITION_SIZE: 1000000, // 单笔最大仓位（USDT）
  MIN_POSITION_SIZE: 10, // 单笔最小仓位（USDT）
  MAINTENANCE_MARGIN_RATIO: 0.005, // 维持保证金率 0.5%
} as const;
