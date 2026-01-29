/**
 * AI Trader Generation Service
 *
 * Generates unique trader configurations using DeepSeek with tool calling
 */

import { DeepSeekChatClient } from './chat';
import { createTraderTool, selectTradingContextTool } from './tools';
import { eventBus } from './events';
import type { Trader } from '@/db/schema';

/**
 * System prompt for AI trader generation
 */
export const TRADER_GENERATION_SYSTEM_PROMPT = `You are an expert cryptocurrency trading system designer specializing in creating unique, profitable, and risk-controlled trading bot configurations.

Your primary objectives are:
1. **Innovation**: Create traders with unique strategies, focus areas, and trading styles that differ from existing ones
2. **Profitability**: Design parameters optimized for consistent returns across different market conditions
3. **Risk Control**: Ensure robust risk management with appropriate stop losses, position sizing, and drawdown limits
4. **Diversity**: Vary aggressiveness levels, time horizons, strategies, and market focuses

When creating a trader:
- Avoid duplicating existing trader names, strategies, or parameter combinations
- Consider different market regimes (bull, bear, sideways)
- Balance risk/reward ratios appropriately
- Set realistic and safe trading parameters

**Description Requirements:**
- Keep descriptions CONCISE and EFFICIENT (1-2 sentences max)
- Focus on key differentiating factors: strategy, timeframe, risk level, and unique approach
- Avoid verbose explanations - save context for the actual parameters
- Example: "Conservative BTC trend follower using 4h/1d intervals with 3x leverage and tight stops."

Use the create_trader tool to generate each trader configuration. All parameters must be carefully considered and validated.`;

/**
 * System prompt for trading pair and interval selection
 */
export const TRADING_CONTEXT_SELECTION_PROMPT = `You are an expert cryptocurrency market analyst specializing in selecting optimal trading pairs and timeframes for different trading strategies.

Your task is to analyze existing traders' preferences and recommend a NEW combination of trading pair and kline intervals that:
1. Differs from existing combinations to ensure diversity
2. Matches appropriate trading characteristics (volatility, liquidity, market activity)
3. Supports various strategy types (scalping, swing, trend following, etc.)

Selection Guidelines:
- High volatility pairs (SOL, DOGE, etc.) + short intervals → Good for scalping/day trading
- Stable pairs (BTC, ETH) + longer intervals → Better for swing/trend following
- Consider liquidity: Ensure sufficient trading volume for the strategy
- Avoid duplicating existing trader combinations

Return your selection using the select_trading_context tool.`;

/**
 * Format existing traders for the prompt - only descriptions array
 */
function formatExistingTradersDescriptions(traders: Trader[]): string {
  if (traders.length === 0) {
    return 'No existing traders found. You are creating the first trader.';
  }

  const descriptions = traders.map((t) => t.description || 'N/A');
  return JSON.stringify(descriptions, null, 2);
}

/**
 * Format existing traders' trading preferences for context selection
 */
function formatExistingTradingPreferences(traders: Trader[]): string {
  if (traders.length === 0) {
    return 'No existing traders. You can select any trading pair and intervals.';
  }

  const preferences = traders
    .filter((t) => t.preferredTradingPair || t.preferredKlineIntervals)
    .map((t) => {
      const pair = t.preferredTradingPair?.symbol || 'N/A';
      const intervals = t.preferredKlineIntervals?.map((k) => k.code).join(', ') || 'N/A';
      return `- ${t.name}: ${pair} with intervals [${intervals}]`;
    })
    .join('\n');

  return preferences || 'No trading preferences found for existing traders.';
}

/**
 * Select trading pair and intervals using AI (pre-call)
 */
async function selectTradingContext(
  existingTraders: Trader[],
  tradingContext: Awaited<ReturnType<typeof fetchTradingContext>>
): Promise<{
  success: boolean;
  tradingPair?: string;
  klineIntervals?: string[];
  reasoning?: string;
  error?: string;
}> {
  const client = new DeepSeekChatClient({
    temperature: 0.7,
    maxTokens: 1000,
  });

  const tools = [selectTradingContextTool];

  const existingPreferences = formatExistingTradingPreferences(existingTraders);
  const availablePairs = tradingContext.tradingPairs.map((p) => p.symbol).join(', ');
  const availableIntervals = tradingContext.klineIntervals
    .map((i) => `${i.code} (${i.label})`)
    .join(', ');

  const userPrompt = `Select a NEW trading pair and kline intervals combination for a trader.

Existing traders' preferences:
${existingPreferences}

Available trading pairs: ${availablePairs}
Available kline intervals: ${availableIntervals}

Requirements:
1. Choose a trading pair and intervals that DIFFER from existing combinations
2. Consider the characteristics: volatility pairs (SOL, DOGE) for scalping, stable pairs (BTC, ETH) for swing/trend
3. Select 2-4 intervals that work together (e.g., 1m+5m for scalping, 1h+4h+1d for swing)
4. Avoid duplicating existing trader selections

Use the select_trading_context tool to make your selection.`;

  try {
    const response = await client.chatWithTools(
      userPrompt,
      TRADING_CONTEXT_SELECTION_PROMPT,
      tools
    );

    if (response.toolCalls && response.toolCalls.length > 0) {
      const toolCall = response.toolCalls[0];

      if (toolCall.name === 'select_trading_context') {
        try {
          const selection = JSON.parse(toolCall.arguments);
          return {
            success: true,
            tradingPair: selection.tradingPair,
            klineIntervals: selection.klineIntervals,
            reasoning: selection.reasoning,
          };
        } catch (parseError) {
          console.error('[selectTradingContext] JSON parse error:', parseError);
          return {
            success: false,
            error: `Failed to parse selection: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`,
          };
        }
      }
    }

    return {
      success: false,
      error: 'No trading context was selected.',
    };
  } catch (error) {
    console.error('[selectTradingContext] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Fetch available trading pairs and intervals for context
 */
async function fetchTradingContext(): Promise<{
  tradingPairs: Array<{ symbol: string; baseAsset: string; quoteAsset: string }>;
  klineIntervals: Array<{ code: string; label: string; seconds: number }>;
}> {
  try {
    const [pairsRes, intervalsRes] = await Promise.all([
      fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/trading-pairs`),
      fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/kline-intervals`),
    ]);

    const [pairsData, intervalsData] = await Promise.all([
      pairsRes.ok ? pairsRes.json() : Promise.resolve([]),
      intervalsRes.ok ? intervalsRes.json() : Promise.resolve([]),
    ]);

    return {
      tradingPairs: pairsData,
      klineIntervals: intervalsData,
    };
  } catch (error) {
    console.error('[fetchTradingContext] Error:', error);
    return {
      tradingPairs: [],
      klineIntervals: [],
    };
  }
}

/**
 * Generate a single trader using AI
 */
export async function generateSingleTrader(
  existingTraders: Trader[],
  index: number = 1,
  total: number = 1
): Promise<{
  success: boolean;
  trader?: Partial<Trader> & {
    status?: string;
    preferredTradingPair?: string;
    preferredKlineIntervals?: string[];
  };
  error?: string;
  reasoning?: string;
}> {
  // Fetch trading context
  const tradingContext = await fetchTradingContext();

  // STEP 1: Select trading pair and intervals (pre-call)
  console.log('[generateSingleTrader] Step 1: Selecting trading context...');
  const contextSelection = await selectTradingContext(existingTraders, tradingContext);

  if (
    !contextSelection.success ||
    !contextSelection.tradingPair ||
    !contextSelection.klineIntervals
  ) {
    return {
      success: false,
      error: `Failed to select trading context: ${contextSelection.error || 'Unknown error'}`,
    };
  }

  console.log('[generateSingleTrader] Trading context selected:', {
    tradingPair: contextSelection.tradingPair,
    klineIntervals: contextSelection.klineIntervals,
    reasoning: contextSelection.reasoning,
  });

  // STEP 2: Generate trader configuration with selected context
  console.log('[generateSingleTrader] Step 2: Generating trader configuration...');
  const client = new DeepSeekChatClient({
    temperature: 0.8,
    maxTokens: 2000,
  });

  // Bind the create trader tool
  const tools = [createTraderTool];

  // Format existing traders - only descriptions
  const tradersDescriptions = formatExistingTradersDescriptions(existingTraders);

  // Create user prompt with selected trading context
  const userPrompt = `Analyze the existing trader descriptions below and create a NEW, UNIQUE trader configuration with a different strategy, focus, or approach:

Existing Traders:
${tradersDescriptions}

**ASSIGNED Trading Context:**
- Trading Pair: ${contextSelection.tradingPair}
- Kline Intervals: ${contextSelection.klineIntervals.join(', ')}

Context Selection Reasoning: ${contextSelection.reasoning}

Requirements:
1. Create a trader with a unique strategy/approach not similar to descriptions above
2. Design your strategy specifically for the ASSIGNED trading pair and intervals above
3. Set parameters that optimize for both profitability AND risk control
4. Consider different market conditions, timeframes, or asset classes
5. Write a CONCISE description (1-2 sentences) highlighting key differentiators

IMPORTANT: The trading pair and intervals are pre-selected. Focus on creating a unique strategy that works well with these parameters.

Use the create_trader tool to generate the configuration.`;

  try {
    // Emit start event with custom metadata for trader generation
    eventBus.emitCallStarted({
      modelType: 'deepseek-chat',
      callType: 'chat',
      userPrompt,
      systemPrompt: TRADER_GENERATION_SYSTEM_PROMPT,
      temperature: 0.8,
      maxTokens: 2000,
    });

    const startTime = Date.now();

    // Call DeepSeek with tools
    const response = await client.chatWithTools(userPrompt, TRADER_GENERATION_SYSTEM_PROMPT, tools);

    const duration = Date.now() - startTime;

    console.log('[generateSingleTrader] Response received:', {
      content: response.content,
      toolCallsCount: response.toolCalls?.length || 0,
      toolCalls: response.toolCalls,
    });

    // Emit completion event with trader generation summary
    eventBus.emitCallCompleted({
      eventId: response.eventId || '',
      timestamp: Date.now(),
      duration,
      tokensUsed: response.totalTokens || 0,
      content: response.content,
      metadata: {
        duration,
        tokensUsed: response.totalTokens || 0,
        traderIndex: index,
        totalTraders: total,
        progressTitle: `[Generating Trader ${index}/${total}]`,
      },
    });

    // Extract tool calls from response
    if (response.toolCalls && response.toolCalls.length > 0) {
      const toolCall = response.toolCalls[0];

      console.log('[generateSingleTrader] Processing tool call:', {
        name: toolCall.name,
        hasArguments: !!toolCall.arguments,
        argumentsLength: toolCall.arguments?.length || 0,
      });

      if (toolCall.name === 'create_trader') {
        try {
          const traderConfig = JSON.parse(toolCall.arguments);
          console.log('[generateSingleTrader] Parsed trader config:', traderConfig);

          // Add default status and selected trading context
          traderConfig.status = 'enabled';
          traderConfig.preferredTradingPair = contextSelection.tradingPair;
          traderConfig.preferredKlineIntervals = contextSelection.klineIntervals;

          return {
            success: true,
            trader: traderConfig,
            reasoning: response.content,
          };
        } catch (parseError) {
          console.error('[generateSingleTrader] JSON parse error:', parseError);

          return {
            success: false,
            error: `Failed to parse trader configuration: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`,
            reasoning: response.content,
          };
        }
      }
    }

    // Fallback: Try to extract JSON from the content
    console.log('[generateSingleTrader] No tool calls found, trying to extract JSON from content');
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        // Check if it looks like a trader config
        if (parsed.name && parsed.tradingStrategy) {
          console.log('[generateSingleTrader] Found trader config in content:', parsed);

          parsed.status = 'enabled';
          parsed.preferredTradingPair = contextSelection.tradingPair;
          parsed.preferredKlineIntervals = contextSelection.klineIntervals;

          return {
            success: true,
            trader: parsed,
            reasoning: response.content,
          };
        }
      } catch (e) {
        console.log('[generateSingleTrader] Failed to parse JSON from content:', e);
      }
    }

    console.log('[generateSingleTrader] No trader configuration found in response');
    return {
      success: false,
      error:
        'No trader configuration was generated. The AI may have failed to use the tool correctly.',
      reasoning: response.content,
    };
  } catch (error) {
    console.error('Error generating trader:', error);

    // Emit error event
    eventBus.emitCallError({
      eventId: '',
      timestamp: Date.now(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Generate multiple traders sequentially
 */
export async function generateMultipleTraders(
  existingTraders: Trader[],
  count: number,
  onProgress?: (
    current: number,
    total: number,
    trader: Partial<Trader> & {
      status?: string;
      preferredTradingPair?: string;
      preferredKlineIntervals?: string[];
    }
  ) => void
): Promise<{
  success: boolean;
  traders?: Array<
    Partial<Trader> & {
      status?: string;
      preferredTradingPair?: string;
      preferredKlineIntervals?: string[];
    }
  >;
  errors?: string[];
}> {
  const generatedTraders: Array<
    Partial<Trader> & {
      status?: string;
      preferredTradingPair?: string;
      preferredKlineIntervals?: string[];
    }
  > = [];
  const errors: string[] = [];
  const allTraders = [...existingTraders];

  // Emit overall start event
  console.log(`[generateMultipleTraders] Starting generation of ${count} traders`);

  for (let i = 0; i < count; i++) {
    const result = await generateSingleTrader(allTraders, i + 1, count);

    if (result.success && result.trader) {
      generatedTraders.push(result.trader);
      allTraders.push({ ...result.trader, id: allTraders.length + 1 } as Trader);

      if (onProgress) {
        onProgress(i + 1, count, result.trader);
      }
    } else {
      errors.push(`Trader ${i + 1}: ${result.error || 'Unknown error'}`);
    }

    // Small delay between generations to avoid rate limiting
    if (i < count - 1) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  // Emit overall completion summary
  console.log(
    `[generateMultipleTraders] Completed: ${generatedTraders.length}/${count} traders generated`
  );

  return {
    success: generatedTraders.length > 0,
    traders: generatedTraders,
    errors: errors.length > 0 ? errors : undefined,
  };
}
