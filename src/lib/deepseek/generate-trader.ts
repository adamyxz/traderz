/**
 * AI Trader Generation Service
 *
 * Generates unique trader configurations using DeepSeek with tool calling
 */

import { DeepSeekChatClient } from './chat';
import { createTraderTool } from './tools';
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
- Provide clear, descriptive names and detailed explanations
- Set realistic and safe trading parameters

Use the create_trader tool to generate each trader configuration. All parameters must be carefully considered and validated.`;

/**
 * Format existing traders for the prompt
 */
function formatExistingTradersTable(traders: Trader[]): string {
  if (traders.length === 0) {
    return 'No existing traders found. You are creating the first trader.';
  }

  let table =
    '| ID | Name | Strategy | Holding Period | Risk Score | Aggressiveness | Max Leverage | Description |\n';
  table += '|---|---|---|---|---|---|---|---|\n';

  traders.forEach((t) => {
    table += `| ${t.id} | ${t.name} | ${t.tradingStrategy} | ${t.holdingPeriod} | ${t.riskPreferenceScore}/10 | ${t.aggressivenessLevel}/10 | ${t.maxLeverage}x | ${t.description || 'N/A'} |\n`;
  });

  return table;
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
  trader?: Partial<Trader> & { status?: string };
  error?: string;
  reasoning?: string;
}> {
  const client = new DeepSeekChatClient({
    temperature: 0.8,
    maxTokens: 2000,
  });

  // Bind the create trader tool
  const tools = [createTraderTool];

  // Format existing traders
  const tradersTable = formatExistingTradersTable(existingTraders);

  // Create user prompt
  const userPrompt = `Analyze the existing traders below and create a NEW, UNIQUE trader configuration with a different strategy, focus, or approach:

${tradersTable}

Requirements:
1. Create a trader with a unique name not in the list above
2. Choose a trading strategy and focus that differs from existing traders
3. Set parameters that optimize for both profitability AND risk control
4. Consider different market conditions, timeframes, or asset classes
5. Provide a clear description explaining the trader's unique approach

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

          // Add default status
          traderConfig.status = 'enabled';

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
    trader: Partial<Trader> & { status?: string }
  ) => void
): Promise<{
  success: boolean;
  traders?: Array<Partial<Trader> & { status?: string }>;
  errors?: string[];
}> {
  const generatedTraders: Array<Partial<Trader> & { status?: string }> = [];
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
