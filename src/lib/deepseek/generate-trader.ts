/**
 * AI Trader Generation Service
 *
 * Generates unique trader configurations using DeepSeek with tool calling
 */

import { DeepSeekChatClient } from './chat';
import { createTraderTool, selectTradingContextTool, selectReadersTool } from './tools';
import type { Trader, tradingPairs, klineIntervals } from '@/db/schema';

/**
 * Extended Trader type with relations
 */
export interface TraderWithRelations extends Trader {
  preferredTradingPair?: typeof tradingPairs.$inferSelect;
  preferredKlineIntervals?: (typeof klineIntervals.$inferSelect)[];
}

/**
 * Reader information for AI selection
 */
interface ReaderInfo {
  id: number;
  name: string;
  description: string | null;
}

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

Your task is to analyze existing traders' preferences and recommend a combination of trading pair and kline intervals that:
1. Encourages exploration of new combinations while respecting proven strategies
2. Matches appropriate trading characteristics
3. Supports various strategy types

Selection Guidelines:
- Consider different asset classes and their unique characteristics
- Balance between trying new combinations and leveraging known working patterns
- Each combination should offer distinct trading opportunities

Return your selection using the select_trading_context tool.`;

/**
 * Format existing traders for the prompt - only descriptions array
 */
function formatExistingTradersDescriptions(traders: TraderWithRelations[]): string {
  if (traders.length === 0) {
    return 'No existing traders found. You are creating the first trader.';
  }

  const descriptions = traders.map((t) => t.description || 'N/A');
  return JSON.stringify(descriptions, null, 2);
}

/**
 * Format existing traders' trading preferences for context selection
 */
function formatExistingTradingPreferences(traders: TraderWithRelations[]): string {
  if (traders.length === 0) {
    return 'No existing traders. You can select any trading pair and intervals.';
  }

  const preferences = traders
    .filter(
      (t) =>
        t.preferredTradingPair ||
        (t.preferredKlineIntervals && t.preferredKlineIntervals.length > 0)
    )
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
  existingTraders: TraderWithRelations[],
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

  const userPrompt = `Select a trading pair and kline intervals combination for a new trader.

Existing traders' preferences:
${existingPreferences}

Available trading pairs: ${availablePairs}
Available kline intervals: ${availableIntervals}

Requirements:
1. Feel encouraged to explore new combinations and diverse strategies
2. Select 2-4 intervals that work together (e.g., 1m+5m for scalping, 1h+4h+1d for swing)
3. Consider both unexplored combinations and proven strategies

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
 * Fetch all available readers for selection
 */
async function fetchReaders(): Promise<ReaderInfo[]> {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/readers`
    );

    if (!response.ok) {
      console.error('[fetchReaders] Failed to fetch readers:', response.status);
      return [];
    }

    const readers = await response.json();
    // Return only essential info for AI selection
    return readers.map((r: ReaderInfo) => ({
      id: r.id,
      name: r.name,
      description: r.description || 'No description available',
    }));
  } catch (error) {
    console.error('[fetchReaders] Error:', error);
    return [];
  }
}

/**
 * Format readers for the prompt
 */
function formatReadersForPrompt(readers: ReaderInfo[]): string {
  if (readers.length === 0) {
    return 'No readers available.';
  }

  return readers.map((r) => `- [ID: ${r.id}] ${r.name}: ${r.description}`).join('\n');
}

/**
 * Select appropriate readers for a trader using AI
 */
interface TraderConfigForReaderSelection {
  name: string;
  tradingStrategy: string;
  holdingPeriod: string;
  aggressivenessLevel: number;
  description: string;
}

async function selectReadersForTrader(
  traderConfig: TraderConfigForReaderSelection,
  tradingPair: string,
  klineIntervals: string[],
  availableReaders: ReaderInfo[]
): Promise<{
  success: boolean;
  readerIds?: number[];
  reasoning?: string;
  error?: string;
}> {
  const client = new DeepSeekChatClient({
    temperature: 0.5,
    maxTokens: 1500,
  });

  const tools = [selectReadersTool];

  const readersList = formatReadersForPrompt(availableReaders);

  const userPrompt = `Select the most appropriate data readers for this trader configuration.

**Trader Configuration:**
- Name: ${traderConfig.name}
- Strategy: ${traderConfig.tradingStrategy}
- Holding Period: ${traderConfig.holdingPeriod}
- Aggressiveness: ${traderConfig.aggressivenessLevel}/10
- Description: ${traderConfig.description}

**Trading Context:**
- Trading Pair: ${tradingPair}
- Kline Intervals: ${klineIntervals.join(', ')}

**Available Readers:**
${readersList}

**Selection Guidelines:**
1. Choose 2-5 readers that are most relevant to this trader's strategy
2. Consider the trading style: trend followers need different data than scalpers
3. Include readers for different data types (price data, indicators, market sentiment, etc.)
4. Avoid redundant readers that provide similar information
5. Prioritize readers that match the timeframe and analysis approach

**Reader Selection Strategy by Trading Style:**
- **Trend Following**: Kline data, moving averages, volume analysis
- **Oscillation/Reversal**: RSI, MACD, Bollinger Bands, overbought/oversold indicators
- **Scalping**: High-frequency price data, order book, short-term momentum
- **Swing**: Daily/weekly data, support/resistance levels, market structure
- **Arbitrage**: Price feeds from multiple exchanges, correlation data
- **Market Making**: Order book depth, spread analysis, volatility metrics

Use the select_readers tool to make your selection.`;

  const systemPrompt = `You are an expert trading system architect specializing in data source selection for automated trading systems.

Your role is to analyze a trader's configuration and select the most appropriate data readers that will provide the necessary information for the trader to make informed decisions.

**Key Principles:**
1. **Relevance**: Only select readers that provide data directly useful for the trader's strategy
2. **Diversity**: Include readers that provide different types of data (price, indicators, sentiment, etc.)
3. **Efficiency**: Don't overload the system with redundant or unnecessary readers
4. **Match Strategy**: Align data sources with the trader's timeframe and approach
5. **Practicality**: Ensure selected readers work together cohesively

Select 2-5 readers that create a well-rounded data ecosystem for this specific trader.`;

  try {
    const response = await client.chatWithTools(userPrompt, systemPrompt, tools);

    if (response.toolCalls && response.toolCalls.length > 0) {
      const toolCall = response.toolCalls[0];

      if (toolCall.name === 'select_readers') {
        try {
          const selection = JSON.parse(toolCall.arguments);
          return {
            success: true,
            readerIds: selection.readerIds,
            reasoning: selection.reasoning,
          };
        } catch (parseError) {
          console.error('[selectReadersForTrader] JSON parse error:', parseError);
          return {
            success: false,
            error: `Failed to parse selection: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`,
          };
        }
      }
    }

    return {
      success: false,
      error: 'No readers were selected.',
    };
  } catch (error) {
    console.error('[selectReadersForTrader] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Generate a single trader using AI
 */
export async function generateSingleTrader(existingTraders: TraderWithRelations[]): Promise<{
  success: boolean;
  trader?: Partial<Trader> & {
    status?: string;
    preferredTradingPair?: string;
    preferredKlineIntervals?: string[];
    selectedReaders?: number[];
  };
  error?: string;
  reasoning?: string;
}> {
  // Fetch trading context and readers in parallel
  const [tradingContext, availableReaders] = await Promise.all([
    fetchTradingContext(),
    fetchReaders(),
  ]);

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

  // Filter existing traders - only include those using the same trading pair
  const relatedTraders = existingTraders.filter(
    (t) => t.preferredTradingPair?.symbol === contextSelection.tradingPair
  );

  console.log('[generateSingleTrader] Filtered related traders:', {
    total: existingTraders.length,
    related: relatedTraders.length,
    tradingPair: contextSelection.tradingPair,
  });

  // Format existing traders - only descriptions of related traders
  const tradersDescriptions = formatExistingTradersDescriptions(relatedTraders);

  // Create user prompt with selected trading context
  const userPrompt = `Create a NEW, UNIQUE trader configuration for the assigned trading context.

**ASSIGNED Trading Context:**
- Trading Pair: ${contextSelection.tradingPair}
- Kline Intervals: ${contextSelection.klineIntervals.join(', ')}

${
  relatedTraders.length > 0
    ? `
Existing Traders for ${contextSelection.tradingPair}:
${tradersDescriptions}

**Important:** Analyze the existing traders above and create a NEW trader with a DIFFERENT strategy, approach, or parameter combination. Avoid duplicating their configurations.
`
    : `
**Note:** This is the first trader for ${contextSelection.tradingPair}. You have full freedom to design an optimal strategy.
`
}

Requirements:
1. Create a trader with a unique strategy/approach
2. Design your strategy specifically for the ASSIGNED trading pair and intervals above
3. Set parameters that optimize for both profitability AND risk control
4. Consider different market conditions, timeframes, or asset classes
5. Write a CONCISE description (1-2 sentences) highlighting key differentiators

IMPORTANT: The trading pair and intervals are pre-selected. Focus on creating a unique strategy that works well with these parameters.

Use the create_trader tool to generate the configuration.`;

  try {
    // Call DeepSeek with tools (events will be emitted automatically by chatWithTools)
    const response = await client.chatWithTools(userPrompt, TRADER_GENERATION_SYSTEM_PROMPT, tools);

    console.log('[generateSingleTrader] Response received:', {
      content: response.content,
      toolCallsCount: response.toolCalls?.length || 0,
      toolCalls: response.toolCalls,
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

          // STEP 3: Select appropriate readers for this trader
          console.log('[generateSingleTrader] Step 3: Selecting readers for trader...');

          if (availableReaders.length > 0) {
            const readersSelection = await selectReadersForTrader(
              traderConfig,
              contextSelection.tradingPair,
              contextSelection.klineIntervals,
              availableReaders
            );

            if (readersSelection.success && readersSelection.readerIds) {
              console.log('[generateSingleTrader] Readers selected:', {
                readerIds: readersSelection.readerIds,
                reasoning: readersSelection.reasoning,
              });
              traderConfig.selectedReaders = readersSelection.readerIds;
            } else {
              console.warn(
                '[generateSingleTrader] Failed to select readers:',
                readersSelection.error
              );
              // Continue without readers - not a critical error
            }
          } else {
            console.warn('[generateSingleTrader] No readers available, skipping reader selection');
          }

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

          // STEP 3: Select appropriate readers for this trader
          console.log('[generateSingleTrader] Step 3: Selecting readers for trader...');

          if (availableReaders.length > 0) {
            const readersSelection = await selectReadersForTrader(
              parsed,
              contextSelection.tradingPair,
              contextSelection.klineIntervals,
              availableReaders
            );

            if (readersSelection.success && readersSelection.readerIds) {
              console.log('[generateSingleTrader] Readers selected:', {
                readerIds: readersSelection.readerIds,
                reasoning: readersSelection.reasoning,
              });
              parsed.selectedReaders = readersSelection.readerIds;
            } else {
              console.warn(
                '[generateSingleTrader] Failed to select readers:',
                readersSelection.error
              );
            }
          } else {
            console.warn('[generateSingleTrader] No readers available, skipping reader selection');
          }

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
  existingTraders: TraderWithRelations[],
  count: number,
  onProgress?: (
    current: number,
    total: number,
    trader: Partial<Trader> & {
      status?: string;
      preferredTradingPair?: string;
      preferredKlineIntervals?: string[];
      selectedReaders?: number[];
    }
  ) => void
): Promise<{
  success: boolean;
  traders?: Array<
    Partial<Trader> & {
      status?: string;
      preferredTradingPair?: string;
      preferredKlineIntervals?: string[];
      selectedReaders?: number[];
    }
  >;
  errors?: string[];
}> {
  const generatedTraders: Array<
    Partial<Trader> & {
      status?: string;
      preferredTradingPair?: string;
      preferredKlineIntervals?: string[];
      selectedReaders?: number[];
    }
  > = [];
  const errors: string[] = [];
  const allTraders = [...existingTraders];

  // Emit overall start event
  console.log(`[generateMultipleTraders] Starting generation of ${count} traders`);

  for (let i = 0; i < count; i++) {
    const result = await generateSingleTrader(allTraders);

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
