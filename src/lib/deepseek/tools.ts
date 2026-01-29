import { tool } from '@langchain/core/tools';
import { z } from 'zod';

/**
 * Trader information tool
 * Retrieves information about a trader's configuration
 */
export const getTraderInfoTool = tool(
  async ({ traderId }) => {
    // This is a placeholder implementation
    // In a real application, this would query the database
    return JSON.stringify(
      {
        traderId,
        name: `Trader ${traderId}`,
        strategy: 'momentum',
        riskLevel: 'medium',
        status: 'active',
        createdAt: new Date().toISOString(),
      },
      null,
      2
    );
  },
  {
    name: 'get_trader_info',
    description:
      'Get information about a specific trader including their configuration, strategy, and current status',
    schema: z.object({
      traderId: z.string().describe('The unique identifier of the trader'),
    }),
  }
);

/**
 * Risk analysis tool
 * Analyzes risk for a given trading scenario
 */
export const analyzeRiskTool = tool(
  async ({ symbol, positionSize, entryPrice, stopLoss }) => {
    // This is a placeholder implementation
    // In a real application, this would perform actual risk calculations
    const riskAmount = positionSize * (entryPrice - stopLoss);
    const riskPercent = (riskAmount / (positionSize * entryPrice)) * 100;

    return JSON.stringify(
      {
        symbol,
        riskAmount: riskAmount.toFixed(2),
        riskPercent: riskPercent.toFixed(2),
        riskLevel: riskPercent > 2 ? 'high' : riskPercent > 1 ? 'medium' : 'low',
        recommendation: riskPercent > 2 ? 'Consider reducing position size' : 'Risk is acceptable',
        timestamp: new Date().toISOString(),
      },
      null,
      2
    );
  },
  {
    name: 'analyze_risk',
    description:
      'Analyze the risk for a trading position including position size, stop loss, and risk percentage',
    schema: z.object({
      symbol: z.string().describe('The trading symbol (e.g., BTCUSDT)'),
      positionSize: z.number().describe('The size of the position in base currency'),
      entryPrice: z.number().describe('The entry price for the position'),
      stopLoss: z.number().describe('The stop loss price'),
    }),
  }
);

/**
 * Get market data tool
 * Fetches current market data for a symbol
 */
export const getMarketDataTool = tool(
  async ({ symbol, timeframe }) => {
    // This is a placeholder implementation
    // In a real application, this would fetch actual market data
    return JSON.stringify(
      {
        symbol,
        timeframe,
        price: (Math.random() * 50000 + 30000).toFixed(2),
        volume: Math.floor(Math.random() * 1000000),
        change24h: (Math.random() * 10 - 5).toFixed(2),
        high24h: (Math.random() * 55000 + 30000).toFixed(2),
        low24h: (Math.random() * 45000 + 25000).toFixed(2),
        timestamp: new Date().toISOString(),
      },
      null,
      2
    );
  },
  {
    name: 'get_market_data',
    description:
      'Get current market data for a trading symbol including price, volume, and 24h statistics',
    schema: z.object({
      symbol: z.string().describe('The trading symbol (e.g., BTCUSDT)'),
      timeframe: z
        .enum(['1m', '5m', '15m', '1h', '4h', '1d'])
        .describe('The timeframe for the data'),
    }),
  }
);

/**
 * Trading decision schema for structured output
 */
export const TradingDecisionSchema = z.object({
  action: z.enum(['buy', 'sell', 'hold']).describe('The recommended trading action'),
  confidence: z.number().min(0).max(1).describe('Confidence level from 0 to 1'),
  reasoning: z.string().describe('Brief explanation for the decision'),
  positionSize: z
    .number()
    .optional()
    .describe('Recommended position size if action is buy or sell'),
  stopLoss: z.number().optional().describe('Recommended stop loss price'),
  takeProfit: z.number().optional().describe('Recommended take profit price'),
  riskLevel: z.enum(['low', 'medium', 'high']).describe('Risk level of this trade'),
  timestamp: z.string().describe('ISO timestamp of the decision'),
});

export type TradingDecision = z.infer<typeof TradingDecisionSchema>;

/**
 * Market analysis schema for structured output
 */
export const MarketAnalysisSchema = z.object({
  symbol: z.string().describe('Trading symbol being analyzed'),
  trend: z.enum(['bullish', 'bearish', 'neutral']).describe('Overall market trend'),
  supportLevels: z.array(z.number()).describe('Key support price levels'),
  resistanceLevels: z.array(z.number()).describe('Key resistance price levels'),
  indicators: z
    .object({
      rsi: z.number().min(0).max(100).describe('RSI indicator value'),
      macd: z.string().describe('MACD signal (bullish/bearish/neutral)'),
      movingAverages: z.string().describe('Moving average analysis'),
    })
    .describe('Technical indicator analysis'),
  sentiment: z.enum(['positive', 'neutral', 'negative']).describe('Market sentiment'),
  recommendation: z.string().describe('Overall trading recommendation'),
  confidence: z.number().min(0).max(1).describe('Confidence in the analysis'),
  timestamp: z.string().describe('ISO timestamp of the analysis'),
});

export type MarketAnalysis = z.infer<typeof MarketAnalysisSchema>;

/**
 * Trader configuration schema for structured output
 */
export const TraderConfigSchema = z.object({
  name: z.string().describe('Name of the trader'),
  strategy: z
    .enum(['momentum', 'mean_reversion', 'trend_following', 'arbitrage'])
    .describe('Trading strategy'),
  riskLevel: z.enum(['conservative', 'moderate', 'aggressive']).describe('Risk tolerance level'),
  maxPositionSize: z.number().describe('Maximum position size in USD'),
  stopLossPercent: z.number().min(0).max(100).describe('Stop loss percentage'),
  takeProfitPercent: z.number().min(0).max(100).describe('Take profit percentage'),
  symbols: z.array(z.string()).describe('List of trading symbols'),
  timeframe: z.string().describe('Preferred timeframe for analysis'),
  maxDailyTrades: z.number().describe('Maximum number of trades per day'),
  useLeverage: z.boolean().describe('Whether to use leverage'),
  leverage: z.number().optional().describe('Leverage multiplier if leverage is used'),
  description: z.string().describe('Description of the trader configuration'),
});

export type TraderConfig = z.infer<typeof TraderConfigSchema>;

/**
 * Risk assessment schema for structured output
 */
export const RiskAssessmentSchema = z.object({
  overallRisk: z.enum(['low', 'medium', 'high', 'extreme']).describe('Overall risk level'),
  riskScore: z.number().min(0).max(100).describe('Risk score from 0 to 100'),
  factors: z
    .array(
      z.object({
        factor: z.string().describe('Name of the risk factor'),
        level: z.enum(['low', 'medium', 'high']).describe('Risk level for this factor'),
        impact: z.string().describe('Description of the impact'),
      })
    )
    .describe('Individual risk factors'),
  recommendations: z.array(z.string()).describe('List of risk mitigation recommendations'),
  positionSizing: z.string().describe('Recommended position sizing strategy'),
  stopLossStrategy: z.string().describe('Recommended stop loss strategy'),
  timestamp: z.string().describe('ISO timestamp of the assessment'),
});

export type RiskAssessment = z.infer<typeof RiskAssessmentSchema>;

/**
 * Create trader tool
 * Creates a new trader with specified configuration
 */
export const createTraderTool = tool(
  async (args) => {
    // This tool returns the configuration for validation
    // The actual creation will be handled by the API
    return JSON.stringify(
      {
        success: true,
        message: 'Trader configuration validated successfully',
        traderConfig: args,
      },
      null,
      2
    );
  },
  {
    name: 'create_trader',
    description:
      'Create a new cryptocurrency trader with specific trading strategy, risk parameters, and behavior settings. Use this tool when you have designed a complete trader configuration.',
    schema: z.object({
      name: z.string().describe('Unique name for the trader'),
      description: z.string().describe('Detailed description of the trader strategy and focus'),
      tradingStrategy: z
        .enum(['trend', 'oscillation', 'arbitrage', 'market_making', 'scalping', 'swing'])
        .describe('Trading strategy type'),
      holdingPeriod: z
        .enum(['intraday', 'short_term', 'medium_term', 'long_term'])
        .describe('Preferred holding period'),
      positionStrategy: z
        .enum(['none', 'martingale', 'pyramid'])
        .describe('Position sizing strategy'),
      aggressivenessLevel: z.number().min(1).max(10).describe('Aggressiveness level (1-10)'),
      maxLeverage: z.number().min(1).max(125).describe('Maximum leverage multiplier'),
      minLeverage: z.number().min(1).max(125).describe('Minimum leverage multiplier'),
      maxPositions: z.number().min(1).max(20).describe('Maximum number of concurrent positions'),
      maxPositionSize: z.number().min(10).describe('Maximum position size in USD'),
      minTradeAmount: z.number().min(1).describe('Minimum trade amount in USD'),
      allowShort: z.boolean().describe('Whether short selling is allowed'),
      maxDrawdown: z.number().min(1).max(100).describe('Maximum acceptable drawdown percentage'),
      stopLossThreshold: z.number().min(1).max(100).describe('Stop loss threshold percentage'),
      positionStopLoss: z.number().min(0.1).max(50).describe('Position stop loss percentage'),
      positionTakeProfit: z.number().min(0.1).max(100).describe('Position take profit percentage'),
      maxConsecutiveLosses: z
        .number()
        .min(1)
        .max(20)
        .describe('Maximum consecutive losses before pause'),
      dailyMaxLoss: z.number().min(1).describe('Maximum daily loss in USD'),
      riskPreferenceScore: z.number().min(1).max(10).describe('Risk preference score (1-10)'),
      heartbeatInterval: z.number().min(1).max(300).describe('Heartbeat interval in seconds'),
      activeTimeStart: z
        .string()
        .regex(/^\d{2}:\d{2}$/)
        .describe('Active time start (HH:mm)'),
      activeTimeEnd: z
        .string()
        .regex(/^\d{2}:\d{2}$/)
        .describe('Active time end (HH:mm)'),
    }),
  }
);

/**
 * Export all tools as an array for easy binding
 */
export const defaultTools = [
  getTraderInfoTool,
  analyzeRiskTool,
  getMarketDataTool,
  createTraderTool,
];

/**
 * Tool categories for organized access
 */
export const toolCategories = {
  trader: [getTraderInfoTool],
  risk: [analyzeRiskTool],
  market: [getMarketDataTool],
  all: defaultTools,
} as const;

/**
 * Helper function to create a custom tool
 */
export function createCustomTool<T extends z.ZodTypeAny>(
  name: string,
  description: string,
  schema: T,
  handler: (input: z.infer<T>) => Promise<string>
) {
  return tool(handler, {
    name,
    description,
    schema,
  });
}

/**
 * Helper to get schema JSON representation
 */
export function getSchemaJson<T extends z.ZodType>(schema: T): T {
  return schema;
}

/**
 * Helper to validate data against a schema
 */
export function validateAgainstSchema<T extends z.ZodTypeAny>(
  schema: T,
  data: unknown
): z.infer<T> {
  return schema.parse(data);
}

/**
 * Helper to safely parse data against a schema
 */
export function safeValidateAgainstSchema<T extends z.ZodTypeAny>(
  schema: T,
  data: unknown
): { success: true; data: z.infer<T> } | { success: false; error: z.ZodError } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}
