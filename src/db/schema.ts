import {
  pgTable,
  serial,
  text,
  timestamp,
  boolean,
  integer,
  numeric,
  pgEnum,
  index,
  primaryKey,
} from 'drizzle-orm/pg-core';

// 交易员状态枚举
export const traderStatusEnum = pgEnum('trader_status', ['enabled', 'disabled', 'paused']);

// 加仓策略枚举
export const positionStrategyEnum = pgEnum('position_strategy', ['martingale', 'pyramid', 'none']);

// 交易策略类型枚举
export const tradingStrategyEnum = pgEnum('trading_strategy', [
  'trend',
  'oscillation',
  'arbitrage',
  'market_making',
  'scalping',
  'swing',
]);

// 持仓周期偏好枚举
export const holdingPeriodEnum = pgEnum('holding_period', [
  'intraday',
  'short_term',
  'medium_term',
  'long_term',
]);

// 交易员模型
export const traders = pgTable('traders', {
  // 基础信息
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  status: traderStatusEnum('status').default('enabled').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),

  // 交易参数
  aggressivenessLevel: integer('aggressiveness_level').notNull(), // 1-10
  maxLeverage: numeric('max_leverage', { precision: 5, scale: 2 }).notNull(),
  minLeverage: numeric('min_leverage', { precision: 5, scale: 2 }).notNull(),
  maxPositions: integer('max_positions').notNull(),
  maxPositionSize: numeric('max_position_size', { precision: 10, scale: 2 }).notNull(), // 单笔最大仓位（金额）
  minTradeAmount: numeric('min_trade_amount', { precision: 10, scale: 2 }).notNull(), // 最小交易金额
  positionStrategy: positionStrategyEnum('position_strategy').default('none').notNull(), // 加仓策略
  allowShort: boolean('allow_short').default(false).notNull(), // 是否允许做空

  // 风险控制
  maxDrawdown: numeric('max_drawdown', { precision: 5, scale: 2 }).notNull(), // 可接受最大回撤（%）
  stopLossThreshold: numeric('stop_loss_threshold', { precision: 5, scale: 2 }).notNull(), // 强制止损线（%）
  positionStopLoss: numeric('position_stop_loss', { precision: 5, scale: 2 }).notNull(), // 单笔止损比例（%）
  positionTakeProfit: numeric('position_take_profit', { precision: 5, scale: 2 }).notNull(), // 单笔止盈比例（%）
  maxConsecutiveLosses: integer('max_consecutive_losses').notNull(), // 最大连续亏损次数
  dailyMaxLoss: numeric('daily_max_loss', { precision: 10, scale: 2 }).notNull(), // 每日最大亏损额度
  riskPreferenceScore: integer('risk_preference_score').notNull(), // 风险偏好评分（1-10）

  // 交易行为
  heartbeatInterval: integer('heartbeat_interval').notNull(), // 心跳频率（秒）
  activeTimeStart: text('active_time_start').notNull(), // 激活时段开始（HH:mm）
  activeTimeEnd: text('active_time_end').notNull(), // 激活时段结束（HH:mm）
  tradingStrategy: tradingStrategyEnum('trading_strategy').notNull(), // 交易策略类型
  holdingPeriod: holdingPeriodEnum('holding_period').notNull(), // 持仓周期偏好

  // 偏好设置
  preferredTradingPairId: integer('preferred_trading_pair_id').references(() => tradingPairs.id), // 偏好交易对（多对一）
});

export type Trader = typeof traders.$inferSelect;
export type NewTrader = typeof traders.$inferInsert;

// 交易对表
export const tradingPairs = pgTable('trading_pairs', {
  id: serial('id').primaryKey(),
  symbol: text('symbol').notNull().unique(), // 如 'BTCUSDT'
  baseAsset: text('base_asset').notNull(), // 'BTC'
  quoteAsset: text('quote_asset').notNull(), // 'USDT'
  status: text('status').default('active').notNull(), // 'active', 'inactive'
  contractType: text('contract_type').default('perpetual').notNull(),
  volume24h: numeric('volume_24h', { precision: 20, scale: 8 }), // 24小时成交量（USDT）
  quoteVolume24h: numeric('quote_volume_24h', { precision: 20, scale: 8 }), // 24小时成交额（USDT）
  volumeRank: integer('volume_rank'), // 成交量排名
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// K线周期表
export const klineIntervals = pgTable('kline_intervals', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(), // '1m', '5m', '1h', '1d'
  label: text('label').notNull(), // '1分钟', '5分钟', '1小时', '1天'
  seconds: integer('seconds').notNull(), // 60, 300, 3600, 86400
  displayOrder: integer('display_order').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export type TradingPair = typeof tradingPairs.$inferSelect;
export type NewTradingPair = typeof tradingPairs.$inferInsert;
export type KlineInterval = typeof klineIntervals.$inferSelect;
export type NewKlineInterval = typeof klineIntervals.$inferInsert;

// 交易员与K线周期多对多关联表
export const traderKlineIntervals = pgTable(
  'trader_kline_intervals',
  {
    traderId: integer('trader_id')
      .notNull()
      .references(() => traders.id, { onDelete: 'cascade' }),
    klineIntervalId: integer('kline_interval_id')
      .notNull()
      .references(() => klineIntervals.id, { onDelete: 'cascade' }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.traderId, table.klineIntervalId] }),
    traderIdx: index('trader_kline_intervals_trader_idx').on(table.traderId),
    klineIntervalIdx: index('trader_kline_intervals_interval_idx').on(table.klineIntervalId),
  })
);

export type TraderKlineInterval = typeof traderKlineIntervals.$inferSelect;
export type NewTraderKlineInterval = typeof traderKlineIntervals.$inferInsert;

// 系统配置表
export const systemConfigurations = pgTable('system_configurations', {
  id: serial('id').primaryKey(),
  key: text('key').notNull().unique(), // 配置键，如 'trading_layout_config'
  value: text('value').notNull(), // JSON字符串存储配置值
  description: text('description'), // 配置描述
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export type SystemConfiguration = typeof systemConfigurations.$inferSelect;
export type NewSystemConfiguration = typeof systemConfigurations.$inferInsert;

// Reader参数类型枚举
export const readerParamTypeEnum = pgEnum('reader_param_type', [
  'string',
  'number',
  'boolean',
  'object',
  'array',
  'enum',
]);

// Readers表
export const readers = pgTable('readers', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),

  // 脚本信息
  scriptPath: text('script_path').notNull(),
  scriptHash: text('script_hash'), // MD5哈希，用于检测变更

  // 执行配置
  timeout: integer('timeout').default(30000),
});

export type Reader = typeof readers.$inferSelect;
export type NewReader = typeof readers.$inferInsert;

// Reader参数表
export const readerParameters = pgTable('reader_parameters', {
  id: serial('id').primaryKey(),
  readerId: integer('reader_id')
    .notNull()
    .references(() => readers.id, { onDelete: 'cascade' }),

  paramName: text('param_name').notNull(),
  paramType: readerParamTypeEnum('param_type').notNull(),
  displayName: text('display_name').notNull(),
  description: text('description'),
  isRequired: boolean('is_required').default(false).notNull(),
  defaultValue: text('default_value'), // JSON字符串
  validationRules: text('validation_rules'), // JSON字符串
  enumValues: text('enum_values'), // JSON数组
});

export type ReaderParameter = typeof readerParameters.$inferSelect;
export type NewReaderParameter = typeof readerParameters.$inferInsert;
