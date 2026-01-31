import { z } from 'zod';

/**
 * Position data for optimization context
 */
export const PositionDataSchema = z.object({
  id: z.number(),
  side: z.enum(['long', 'short']),
  status: z.enum(['open', 'closed', 'liquidated']),
  entryPrice: z.number(),
  currentPrice: z.number(),
  leverage: z.number(),
  quantity: z.number(),
  positionSize: z.number(),
  margin: z.number(),
  unrealizedPnl: z.number(),
  realizedPnl: z.number(),
  stopLossPrice: z.number().nullable(),
  takeProfitPrice: z.number().nullable(),
  openedAt: z.string(),
  closedAt: z.string().nullable(),
  tradingPairSymbol: z.string(),
});

export type PositionData = z.infer<typeof PositionDataSchema>;

/**
 * K-line data for market context
 */
export const KlineDataSchema = z.object({
  timestamp: z.number(),
  open: z.number(),
  high: z.number(),
  low: z.number(),
  close: z.number(),
  volume: z.number(),
});

export type KlineData = z.infer<typeof KlineDataSchema>;

/**
 * Performance metrics calculated from positions
 */
export const PerformanceMetricsSchema = z.object({
  totalPositions: z.number(),
  openPositions: z.number(),
  closedPositions: z.number(),
  liquidatedPositions: z.number(),
  winRate: z.number(), // 0-100
  totalPnl: z.number(),
  totalReturnRate: z.number(), // percentage
  avgWinAmount: z.number(),
  avgLossAmount: z.number(),
  largestWin: z.number(),
  largestLoss: z.number(),
  avgHoldingPeriodHours: z.number(),
  maxDrawdown: z.number(), // percentage
  maxConsecutiveLosses: z.number(),
  profitFactor: z.number(), // gross wins / gross losses
  sharpeRatio: z.number().nullable(),
  longPositions: z.number(),
  shortPositions: z.number(),
  longWinRate: z.number(),
  shortWinRate: z.number(),
});

export type PerformanceMetrics = z.infer<typeof PerformanceMetricsSchema>;

/**
 * Trader configuration context sent to LLM
 */
export const TraderContextSchema = z.object({
  // Basic info
  id: z.number(),
  name: z.string(),
  description: z.string().nullable(),
  status: z.enum(['enabled', 'disabled', 'paused']),

  // Trading parameters
  aggressivenessLevel: z.number().min(1).max(10),
  maxLeverage: z.number().min(1).max(125),
  minLeverage: z.number().min(1).max(125),
  maxPositions: z.number().min(1).max(50),
  maxPositionSize: z.number().positive(),
  minTradeAmount: z.number().positive(),
  positionStrategy: z.enum(['martingale', 'pyramid', 'none']),
  allowShort: z.boolean(),

  // Risk control
  maxDrawdown: z.number().min(0).max(100),
  stopLossThreshold: z.number().min(0).max(100),
  positionStopLoss: z.number().min(0).max(100),
  positionTakeProfit: z.number().min(0).max(1000),
  maxConsecutiveLosses: z.number().min(1).max(20),
  dailyMaxLoss: z.number().positive(),
  riskPreferenceScore: z.number().min(1).max(10),

  // Trading behavior
  heartbeatInterval: z.number().min(10).max(86400),
  activeTimeStart: z.string().regex(/^\d{2}:\d{2}$/),
  activeTimeEnd: z.string().regex(/^\d{2}:\d{2}$/),
  tradingStrategy: z.enum([
    'trend',
    'oscillation',
    'arbitrage',
    'market_making',
    'scalping',
    'swing',
  ]),
  holdingPeriod: z.enum(['intraday', 'short_term', 'medium_term', 'long_term']),

  // Preferences
  preferredTradingPairSymbol: z.string().nullable(),
  createdAt: z.string(),
  lastOptimizedAt: z.string().nullable(),
});

export type TraderContext = z.infer<typeof TraderContextSchema>;

/**
 * Full optimization request context
 */
export const OptimizationContextSchema = z.object({
  trader: TraderContextSchema,
  performance: PerformanceMetricsSchema,
  recentPositions: z.array(PositionDataSchema),
  marketData: z
    .object({
      symbol: z.string(),
      interval: z.string(),
      klines: z.array(KlineDataSchema),
    })
    .nullable(),
  periodStart: z.string(),
  periodEnd: z.string(),
});

export type OptimizationContext = z.infer<typeof OptimizationContextSchema>;

/**
 * Optimization suggestion from LLM
 * Only includes mutable fields that can be optimized
 */
export const OptimizationSuggestionSchema = z.object({
  // Trading parameters (mutable)
  aggressivenessLevel: z.number().min(1).max(10).optional(),
  maxLeverage: z.number().min(1).max(125).optional(),
  minLeverage: z.number().min(1).max(125).optional(),
  maxPositions: z.number().min(1).max(50).optional(),
  maxPositionSize: z.number().positive().optional(),
  minTradeAmount: z.number().positive().optional(),
  positionStrategy: z.enum(['martingale', 'pyramid', 'none']).optional(),
  allowShort: z.boolean().optional(),

  // Risk control (mutable)
  maxDrawdown: z.number().min(0).max(100).optional(),
  stopLossThreshold: z.number().min(0).max(100).optional(),
  positionStopLoss: z.number().min(0).max(100).optional(),
  positionTakeProfit: z.number().min(0).max(1000).optional(),
  maxConsecutiveLosses: z.number().min(1).max(20).optional(),
  dailyMaxLoss: z.number().positive().optional(),
  riskPreferenceScore: z.number().min(1).max(10).optional(),

  // Trading behavior (mutable)
  heartbeatInterval: z.number().min(10).max(86400).optional(),
  activeTimeStart: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional(),
  activeTimeEnd: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional(),
  tradingStrategy: z
    .enum(['trend', 'oscillation', 'arbitrage', 'market_making', 'scalping', 'swing'])
    .optional(),
  holdingPeriod: z.enum(['intraday', 'short_term', 'medium_term', 'long_term']).optional(),

  // Reasoning (required)
  reasoning: z
    .string()
    .min(50)
    .describe(
      'Detailed explanation of why these changes were suggested based on performance analysis'
    ),

  // Expected impact (optional)
  expectedImpact: z
    .string()
    .optional()
    .describe('Expected impact of these changes on trader performance'),
});

export type OptimizationSuggestion = z.infer<typeof OptimizationSuggestionSchema>;

/**
 * Full LLM response wrapper
 */
export const OptimizationResponseSchema = z.object({
  suggestions: OptimizationSuggestionSchema,
});

export type OptimizationResponse = z.infer<typeof OptimizationResponseSchema>;

/**
 * Validation helpers
 */
export function clampValue(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function validateOptimizationSuggestions(
  suggestions: unknown
): { success: true; data: OptimizationSuggestion } | { success: false; error: string } {
  const result = OptimizationSuggestionSchema.safeParse(suggestions);

  if (result.success) {
    // Additional validation: ensure at least one field is being changed
    const hasChanges = Object.keys(result.data).some(
      (key) =>
        key !== 'reasoning' &&
        key !== 'expectedImpact' &&
        result.data[key as keyof typeof result.data] !== undefined
    );

    if (!hasChanges) {
      return { success: false, error: 'At least one field must be suggested for change' };
    }

    return { success: true, data: result.data };
  }

  return {
    success: false,
    error: result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; '),
  };
}
