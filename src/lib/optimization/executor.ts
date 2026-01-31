import { db } from '@/db';
import { traders, traderOptimizations, positions, tradingPairs } from '@/db/schema';
import { eq, and, gte, lte, desc } from 'drizzle-orm';
import { DeepSeekChatClient } from '@/lib/deepseek/chat';
import type { Trader } from '@/db/schema';
import {
  buildOptimizationSystemPrompt,
  buildOptimizationUserPrompt,
  buildOptimizationContext,
} from './prompts';
import {
  OptimizationSuggestionSchema,
  type TraderContext,
  type PositionData,
  type KlineData,
  validateOptimizationSuggestions,
} from './schemas';

/**
 * Convert a trader from the database to TraderContext format
 */
function traderToContext(trader: Trader, preferredTradingPairSymbol: string | null): TraderContext {
  return {
    id: trader.id,
    name: trader.name,
    description: trader.description,
    status: trader.status,
    aggressivenessLevel: trader.aggressivenessLevel,
    maxLeverage: parseFloat(trader.maxLeverage),
    minLeverage: parseFloat(trader.minLeverage),
    maxPositions: trader.maxPositions,
    maxPositionSize: parseFloat(trader.maxPositionSize),
    minTradeAmount: parseFloat(trader.minTradeAmount),
    positionStrategy: trader.positionStrategy,
    allowShort: trader.allowShort,
    maxDrawdown: parseFloat(trader.maxDrawdown),
    stopLossThreshold: parseFloat(trader.stopLossThreshold),
    positionStopLoss: parseFloat(trader.positionStopLoss),
    positionTakeProfit: parseFloat(trader.positionTakeProfit),
    maxConsecutiveLosses: trader.maxConsecutiveLosses,
    dailyMaxLoss: parseFloat(trader.dailyMaxLoss),
    riskPreferenceScore: trader.riskPreferenceScore,
    heartbeatInterval: trader.heartbeatInterval,
    activeTimeStart: trader.activeTimeStart,
    activeTimeEnd: trader.activeTimeEnd,
    tradingStrategy: trader.tradingStrategy,
    holdingPeriod: trader.holdingPeriod,
    preferredTradingPairSymbol,
    createdAt: trader.createdAt.toISOString(),
    lastOptimizedAt: trader.lastOptimizedAt?.toISOString() || null,
  };
}

/**
 * Convert a position from the database to PositionData format
 */
function positionToData(position: unknown, tradingPairSymbol: string): PositionData {
  const p = position as {
    id: number;
    side: string;
    status: string;
    entryPrice: string;
    currentPrice: string;
    leverage: string;
    quantity: string;
    positionSize: string;
    margin: string;
    unrealizedPnl: string;
    realizedPnl: string;
    stopLossPrice: string | null;
    takeProfitPrice: string | null;
    openedAt: Date;
    closedAt: Date | null;
  };

  return {
    id: p.id,
    side: p.side as 'long' | 'short',
    status: p.status as 'open' | 'closed' | 'liquidated',
    entryPrice: parseFloat(p.entryPrice),
    currentPrice: parseFloat(p.currentPrice),
    leverage: parseFloat(p.leverage),
    quantity: parseFloat(p.quantity),
    positionSize: parseFloat(p.positionSize),
    margin: parseFloat(p.margin),
    unrealizedPnl: parseFloat(p.unrealizedPnl),
    realizedPnl: parseFloat(p.realizedPnl),
    stopLossPrice: p.stopLossPrice ? parseFloat(p.stopLossPrice) : null,
    takeProfitPrice: p.takeProfitPrice ? parseFloat(p.takeProfitPrice) : null,
    openedAt: p.openedAt.toISOString(),
    closedAt: p.closedAt?.toISOString() || null,
    tradingPairSymbol,
  };
}

/**
 * Convert Binance kline data to KlineData format
 */
function klineToData(kline: {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}): KlineData {
  return {
    timestamp: kline.time * 1000, // Convert to milliseconds
    open: kline.open,
    high: kline.high,
    low: kline.low,
    close: kline.close,
    volume: kline.volume,
  };
}

/**
 * Fetch K-line data for market context
 */
async function fetchKlineData(symbol: string, interval: string, limit: number = 100) {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const url = `${baseUrl}/api/trading/history?symbol=${symbol}&interval=${interval}&limit=${limit}`;
    const response = await fetch(url);

    if (!response.ok) {
      console.warn(`[Optimization] Failed to fetch K-line data: ${response.statusText}`);
      return null;
    }

    const klines = await response.json();
    return {
      symbol,
      interval,
      klines: klines.map(klineToData),
    };
  } catch (error) {
    console.error('[Optimization] Error fetching K-line data:', error);
    return null;
  }
}

/**
 * Execute trader optimization
 * @param args.traderId - ID of the trader to optimize
 * @param args.force - Force optimization even with insufficient data (minimum 5 positions)
 */
export async function executeOptimization(args: { traderId: number; force?: boolean }): Promise<{
  success: boolean;
  optimizationId?: number;
  error?: string;
  data?: {
    reasoning: string;
    appliedChanges: string;
    previousConfig: string;
    suggestedConfig: string;
  };
}> {
  const startTime = Date.now();
  const traderId = args.traderId;
  const force = args.force || false;

  // 1. Fetch trader
  const [trader] = await db.select().from(traders).where(eq(traders.id, traderId)).limit(1);

  if (!trader) {
    return { success: false, error: `Trader ${traderId} not found` };
  }

  // Check for existing in-progress optimization
  const [existingOptimization] = await db
    .select()
    .from(traderOptimizations)
    .where(
      and(eq(traderOptimizations.traderId, traderId), eq(traderOptimizations.status, 'in_progress'))
    )
    .limit(1);

  if (existingOptimization) {
    return { success: false, error: 'An optimization is already in progress for this trader' };
  }

  // 2. Determine analysis period
  const periodEnd = new Date();
  const periodStart = trader.lastOptimizedAt
    ? new Date(trader.lastOptimizedAt)
    : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago if never optimized

  // 3. Fetch positions within period
  const positionRecords = await db
    .select({
      id: positions.id,
      side: positions.side,
      status: positions.status,
      entryPrice: positions.entryPrice,
      currentPrice: positions.currentPrice,
      leverage: positions.leverage,
      quantity: positions.quantity,
      positionSize: positions.positionSize,
      margin: positions.margin,
      unrealizedPnl: positions.unrealizedPnl,
      realizedPnl: positions.realizedPnl,
      stopLossPrice: positions.stopLossPrice,
      takeProfitPrice: positions.takeProfitPrice,
      openedAt: positions.openedAt,
      closedAt: positions.closedAt,
    })
    .from(positions)
    .where(
      and(
        eq(positions.traderId, traderId),
        gte(positions.openedAt, periodStart),
        lte(positions.openedAt, periodEnd)
      )
    )
    .orderBy(desc(positions.openedAt));

  // Check for minimum closed positions
  const closedPositions = positionRecords.filter((p) => p.status === 'closed');
  if (closedPositions.length < 5 && !force) {
    return {
      success: false,
      error: `Insufficient data: trader has only ${closedPositions.length} closed positions (minimum 5 required). Use force: true to override.`,
    };
  }

  // Get preferred trading pair symbol
  let preferredTradingPairSymbol = 'BTCUSDT'; // Default fallback
  if (trader.preferredTradingPairId) {
    const [pair] = await db
      .select()
      .from(tradingPairs)
      .where(eq(tradingPairs.id, trader.preferredTradingPairId))
      .limit(1);
    if (pair) {
      preferredTradingPairSymbol = pair.symbol;
    }
  }

  // 4. Fetch K-line data (30m interval for medium-term analysis)
  const marketData = await fetchKlineData(preferredTradingPairSymbol, '30m', 100);

  // 5. Build context
  const traderContext = traderToContext(trader, preferredTradingPairSymbol);
  const positionData = positionRecords.map((p) => positionToData(p, preferredTradingPairSymbol));

  const optimizationContext = buildOptimizationContext(
    traderContext,
    positionData,
    marketData,
    periodStart,
    periodEnd
  );

  // 6. Create optimization record
  const [optimizationRecord] = await db
    .insert(traderOptimizations)
    .values({
      traderId,
      startedAt: new Date(),
      positionCount: positionRecords.length,
      periodStart,
      periodEnd,
      llmRequest: JSON.stringify(optimizationContext),
      llmResponse: '', // Will be updated later
      llmReasoning: '',
      previousConfig: JSON.stringify(trader),
      suggestedConfig: '',
      appliedChanges: '',
      status: 'in_progress',
    })
    .returning();

  const optimizationId = optimizationRecord.id;

  try {
    // 7. Build prompts
    const systemPrompt = buildOptimizationSystemPrompt();
    const userPrompt = buildOptimizationUserPrompt(optimizationContext);

    // 8. Call LLM with structured output
    const llmClient = new DeepSeekChatClient({
      temperature: 0.5,
      maxTokens: 3000,
    });
    const structuredRunner = llmClient.withStructuredOutput(OptimizationSuggestionSchema);

    const llmResponse = await structuredRunner.invokeWithOptions(userPrompt, systemPrompt, {
      callType: 'trader-optimization',
      metadata: {
        source: 'trader-optimization',
        optimizationId,
        traderId,
        traderName: trader.name,
        positionCount: positionRecords.length,
      },
    });

    // 9. Validate response
    const validation = validateOptimizationSuggestions(llmResponse);
    if (!validation.success) {
      throw new Error(`LLM response validation failed: ${validation.error}`);
    }

    const suggestions = validation.data;

    // 10. Extract only changed fields
    const changes: Record<string, unknown> = {};
    const previousConfig = JSON.parse(JSON.stringify(trader)); // Deep clone

    // Map of field names to database column names
    const fieldMapping: Record<string, keyof typeof previousConfig> = {
      aggressivenessLevel: 'aggressivenessLevel',
      maxLeverage: 'maxLeverage',
      minLeverage: 'minLeverage',
      maxPositions: 'maxPositions',
      maxPositionSize: 'maxPositionSize',
      minTradeAmount: 'minTradeAmount',
      positionStrategy: 'positionStrategy',
      allowShort: 'allowShort',
      maxDrawdown: 'maxDrawdown',
      stopLossThreshold: 'stopLossThreshold',
      positionStopLoss: 'positionStopLoss',
      positionTakeProfit: 'positionTakeProfit',
      maxConsecutiveLosses: 'maxConsecutiveLosses',
      dailyMaxLoss: 'dailyMaxLoss',
      riskPreferenceScore: 'riskPreferenceScore',
      heartbeatInterval: 'heartbeatInterval',
      activeTimeStart: 'activeTimeStart',
      activeTimeEnd: 'activeTimeEnd',
      tradingStrategy: 'tradingStrategy',
      holdingPeriod: 'holdingPeriod',
    };

    // Build update data with only changed fields
    const updateData: Record<string, unknown> = {
      lastOptimizedAt: new Date(),
    };

    for (const [key, value] of Object.entries(suggestions)) {
      if (key === 'reasoning' || key === 'expectedImpact') continue;

      const dbField = fieldMapping[key];
      if (!dbField) continue;

      const currentValue = previousConfig[dbField];

      // Skip if value is unchanged
      if (JSON.stringify(value) === JSON.stringify(currentValue)) continue;

      changes[key] = {
        from: currentValue,
        to: value,
      };

      updateData[dbField] = value;
    }

    // 11. Update trader with new config (only changed fields)
    if (Object.keys(updateData).length > 1) {
      // Only update if there are actual changes (beyond lastOptimizedAt)
      await db.update(traders).set(updateData).where(eq(traders.id, traderId));
    }

    // 12. Update optimization record
    const completedAt = new Date();
    const duration = Date.now() - startTime;

    await db
      .update(traderOptimizations)
      .set({
        completedAt,
        duration,
        llmResponse: JSON.stringify(llmResponse),
        llmReasoning: suggestions.reasoning,
        suggestedConfig: JSON.stringify(llmResponse),
        appliedChanges: JSON.stringify(changes),
        status: 'completed',
      })
      .where(eq(traderOptimizations.id, optimizationId));

    return {
      success: true,
      optimizationId,
      data: {
        reasoning: suggestions.reasoning,
        appliedChanges: JSON.stringify(changes),
        previousConfig: JSON.stringify(previousConfig),
        suggestedConfig: JSON.stringify(llmResponse),
      },
    };
  } catch (error) {
    console.error('[Optimization] Error:', error);

    // Update optimization record with error
    await db
      .update(traderOptimizations)
      .set({
        completedAt: new Date(),
        duration: Date.now() - startTime,
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      })
      .where(eq(traderOptimizations.id, optimizationId));

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Optimization failed',
    };
  }
}

/**
 * Get optimization history for a trader
 */
export async function getOptimizationHistory(args: { traderId: number; limit?: number }): Promise<
  Array<{
    id: number;
    traderId: number;
    startedAt: Date;
    completedAt: Date | null;
    duration: number | null;
    positionCount: number;
    periodStart: Date;
    periodEnd: Date;
    llmReasoning: string | null;
    status: string;
    errorMessage: string | null;
  }>
> {
  const { traderId, limit = 20 } = args;

  const history = await db
    .select({
      id: traderOptimizations.id,
      traderId: traderOptimizations.traderId,
      startedAt: traderOptimizations.startedAt,
      completedAt: traderOptimizations.completedAt,
      duration: traderOptimizations.duration,
      positionCount: traderOptimizations.positionCount,
      periodStart: traderOptimizations.periodStart,
      periodEnd: traderOptimizations.periodEnd,
      llmReasoning: traderOptimizations.llmReasoning,
      status: traderOptimizations.status,
      errorMessage: traderOptimizations.errorMessage,
    })
    .from(traderOptimizations)
    .where(eq(traderOptimizations.traderId, traderId))
    .orderBy(desc(traderOptimizations.startedAt))
    .limit(limit);

  return history;
}
