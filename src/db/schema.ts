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

// 交易员与Reader多对多关联表
export const traderReaders = pgTable(
  'trader_readers',
  {
    traderId: integer('trader_id')
      .notNull()
      .references(() => traders.id, { onDelete: 'cascade' }),
    readerId: integer('reader_id')
      .notNull()
      .references(() => readers.id, { onDelete: 'cascade' }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.traderId, table.readerId] }),
    traderIdx: index('trader_readers_trader_idx').on(table.traderId),
    readerIdx: index('trader_readers_reader_idx').on(table.readerId),
  })
);

export type TraderReader = typeof traderReaders.$inferSelect;
export type NewTraderReader = typeof traderReaders.$inferInsert;

// ==================== 仓位模型系统 ====================

// 仓位方向枚举
export const positionSideEnum = pgEnum('position_side', ['long', 'short']);

// 仓位状态枚举
export const positionStatusEnum = pgEnum('position_status', ['open', 'closed', 'liquidated']);

// 历史记录操作类型枚举
export const historyActionEnum = pgEnum('history_action', [
  'open',
  'close',
  'liquidate',
  'price_update',
  'stop_loss_triggered',
  'take_profit_triggered',
  'margin_added',
  'margin_removed',
  'modify_sl_tp',
]);

// Heartbeat状态枚举
export const heartbeatStatusEnum = pgEnum('heartbeat_status', [
  'pending',
  'in_progress',
  'completed',
  'failed',
  'skipped_outside_hours',
  'skipped_no_intervals',
  'skipped_no_readers',
]);

// 仓位表
export const positions = pgTable(
  'positions',
  {
    // 基础信息
    id: serial('id').primaryKey(),
    traderId: integer('trader_id')
      .notNull()
      .references(() => traders.id, { onDelete: 'cascade' }),
    tradingPairId: integer('trading_pair_id')
      .notNull()
      .references(() => tradingPairs.id, { onDelete: 'restrict' }),

    // 仓位方向和状态
    side: positionSideEnum('side').notNull(),
    status: positionStatusEnum('status').default('open').notNull(),

    // 价格信息
    entryPrice: numeric('entry_price', { precision: 20, scale: 8 }).notNull(), // 开仓价
    currentPrice: numeric('current_price', { precision: 20, scale: 8 }).notNull(), // 当前价

    // 仓位参数
    leverage: numeric('leverage', { precision: 5, scale: 2 }).notNull(), // 杠杆倍数
    quantity: numeric('quantity', { precision: 20, scale: 8 }).notNull(), // 数量（基础货币）
    positionSize: numeric('position_size', { precision: 20, scale: 8 }).notNull(), // 仓位大小（USDT）
    margin: numeric('margin', { precision: 20, scale: 8 }).notNull(), // 保证金（USDT）

    // 费用和盈亏
    openFee: numeric('open_fee', { precision: 20, scale: 8 }).notNull().default('0'), // 开仓手续费
    closeFee: numeric('close_fee', { precision: 20, scale: 8 }).notNull().default('0'), // 平仓手续费
    unrealizedPnl: numeric('unrealized_pnl', { precision: 20, scale: 8 }).notNull().default('0'), // 未实现盈亏
    realizedPnl: numeric('realized_pnl', { precision: 20, scale: 8 }).notNull().default('0'), // 已实现盈亏

    // 止盈止损
    stopLossPrice: numeric('stop_loss_price', { precision: 20, scale: 8 }), // 止损价
    takeProfitPrice: numeric('take_profit_price', { precision: 20, scale: 8 }), // 止盈价

    // 时间戳
    openedAt: timestamp('opened_at').defaultNow().notNull(),
    closedAt: timestamp('closed_at'),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    traderIdx: index('positions_trader_idx').on(table.traderId),
    tradingPairIdx: index('positions_trading_pair_idx').on(table.tradingPairId),
    statusIdx: index('positions_status_idx').on(table.status),
    openedAtIdx: index('positions_opened_at_idx').on(table.openedAt),
    // 组合索引：查询某交易员的持仓
    traderStatusIdx: index('positions_trader_status_idx').on(table.traderId, table.status),
  })
);

export type Position = typeof positions.$inferSelect;
export type NewPosition = typeof positions.$inferInsert;

// 仓位历史记录表
export const positionHistory = pgTable(
  'position_history',
  {
    id: serial('id').primaryKey(),
    positionId: integer('position_id')
      .notNull()
      .references(() => positions.id, { onDelete: 'cascade' }),

    // 操作信息
    action: historyActionEnum('action').notNull(),
    price: numeric('price', { precision: 20, scale: 8 }), // 操作时的价格
    quantity: numeric('quantity', { precision: 20, scale: 8 }), // 操作的数量

    // 盈亏和费用
    pnl: numeric('pnl', { precision: 20, scale: 8 }), // 盈亏
    fee: numeric('fee', { precision: 20, scale: 8 }), // 手续费

    // 额外信息（JSON格式）
    metadata: text('metadata'), // 存储额外信息，如触发原因等

    // 时间戳
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    positionIdx: index('position_history_position_idx').on(table.positionId),
    actionIdx: index('position_history_action_idx').on(table.action),
    createdAtIdx: index('position_history_created_at_idx').on(table.createdAt),
    // 组合索引：查询某仓位的历史记录
    positionCreatedAtIdx: index('position_history_position_created_idx').on(
      table.positionId,
      table.createdAt
    ),
  })
);

export type PositionHistory = typeof positionHistory.$inferSelect;
export type NewPositionHistory = typeof positionHistory.$inferInsert;

// 价格缓存表
export const priceCache = pgTable(
  'price_cache',
  {
    id: serial('id').primaryKey(),
    tradingPairId: integer('trading_pair_id')
      .notNull()
      .references(() => tradingPairs.id, { onDelete: 'cascade' })
      .unique(),

    // 价格信息
    price: numeric('price', { precision: 20, scale: 8 }).notNull(), // 当前价格
    priceChange24h: numeric('price_change_24h', { precision: 20, scale: 8 }), // 24小时价格变化
    priceChangePercent24h: numeric('price_change_percent_24h', { precision: 10, scale: 4 }), // 24小时价格变化百分比

    // 时间戳
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    updatedAtIdx: index('price_cache_updated_at_idx').on(table.updatedAt),
  })
);

export type PriceCache = typeof priceCache.$inferSelect;
export type NewPriceCache = typeof priceCache.$inferInsert;

// 心跳历史记录表
export const heartbeatHistory = pgTable(
  'heartbeat_history',
  {
    id: serial('id').primaryKey(),
    traderId: integer('trader_id')
      .notNull()
      .references(() => traders.id, { onDelete: 'cascade' }),

    status: heartbeatStatusEnum('status').notNull(),

    triggeredAt: timestamp('triggered_at').defaultNow().notNull(),
    startedAt: timestamp('started_at'),
    completedAt: timestamp('completed_at'),
    duration: integer('duration'), // 执行时长（毫秒）

    wasWithinActiveHours: boolean('was_within_active_hours').default(true).notNull(),

    microDecisions: text('micro_decisions'), // JSON array - 各时间微决策
    finalDecision: text('final_decision'), // JSON object - 综合决策

    executionAction: text('execution_action'), // 执行的操作类型
    executionResult: text('execution_result'), // JSON object - 执行结果

    readersExecuted: text('readers_executed'), // JSON array - Reader执行记录
    errorMessage: text('error_message'),
    metadata: text('metadata'), // JSON object - 额外元数据
  },
  (table) => ({
    traderIdx: index('heartbeat_history_trader_idx').on(table.traderId),
    statusIdx: index('heartbeat_history_status_idx').on(table.status),
    triggeredAtIdx: index('heartbeat_history_triggered_at_idx').on(table.triggeredAt),
  })
);

export type HeartbeatHistory = typeof heartbeatHistory.$inferSelect;
export type NewHeartbeatHistory = typeof heartbeatHistory.$inferInsert;
