/**
 * DeepSeek Module Usage Examples
 *
 * This file demonstrates various ways to use the new DeepSeek LangChain module
 */

import {
  // Classes
  DeepSeekChatClient,
  DeepSeekReasonerClient,
  // Convenience functions
  callDeepSeekChat,
  callDeepSeekReasoner,
  streamDeepSeekChat,
  streamDeepSeekReasoner,
  // Singletons
  deepSeekChatClient,
  // Factory functions
  createDeepSeekChatClient,
  // Tools
  getTraderInfoTool,
  analyzeRiskTool,
  getMarketDataTool,
  // Schemas
  TradingDecisionSchema,
  MarketAnalysisSchema,
  TraderConfigSchema,
} from './index';

// Unused imports are kept for documentation purposes
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { createDeepSeekReasonerClient, deepSeekReasonerClient, defaultTools } from './index';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';

// ============================================================================
// Example 1: Basic Chat
// ============================================================================

async function example1_basicChat() {
  console.log('\n=== Example 1: Basic Chat ===\n');

  // Using convenience function
  const response1 = await callDeepSeekChat('What is TypeScript?');
  console.log('Response:', response1);

  // Using singleton
  const response2 = await deepSeekChatClient.chat('Explain React in one sentence');
  console.log('Response:', response2);

  // Using custom client
  const client = new DeepSeekChatClient({ temperature: 0.3 });
  const response3 = await client.chat('What is the capital of Japan?');
  console.log('Response:', response3);
}

// ============================================================================
// Example 2: Chat with System Prompt
// ============================================================================

async function example2_chatWithSystemPrompt() {
  console.log('\n=== Example 2: Chat with System Prompt ===\n');

  const client = new DeepSeekChatClient();

  const response = await client.chat(
    'What should I trade today?',
    'You are a conservative financial advisor. Always recommend caution and risk management.'
  );

  console.log('Response:', response);
}

// ============================================================================
// Example 3: Streaming Chat
// ============================================================================

async function example3_streamingChat() {
  console.log('\n=== Example 3: Streaming Chat ===\n');

  console.log('Streaming response: ');
  for await (const chunk of streamDeepSeekChat('Tell me a short story about a trader')) {
    process.stdout.write(chunk);
  }
  console.log('\n');
}

// ============================================================================
// Example 4: Basic Reasoner
// ============================================================================

async function example4_basicReasoner() {
  console.log('\n=== Example 4: Basic Reasoner ===\n');

  // Using convenience function
  const { reasoning, answer } = await callDeepSeekReasoner(
    'If I have 5 apples and eat 2, then buy 3 more, how many do I have?'
  );

  console.log('Reasoning:', reasoning);
  console.log('Answer:', answer);
}

// ============================================================================
// Example 5: Streaming Reasoner
// ============================================================================

async function example5_streamingReasoner() {
  console.log('\n=== Example 5: Streaming Reasoner ===\n');

  console.log('Reasoning process:\n');
  for await (const chunk of streamDeepSeekReasoner(
    'What is the optimal position size for a $10,000 account with 2% risk?'
  )) {
    if (chunk.type === 'reasoning') {
      process.stdout.write(chunk.content);
    } else {
      console.log('\n\nFinal Answer:', chunk.content);
    }
  }
  console.log('\n');
}

// ============================================================================
// Example 6: Tool Calling
// ============================================================================

async function example6_toolCalling() {
  console.log('\n=== Example 6: Tool Calling ===\n');

  // Create a custom tool
  const getPriceTool = tool(
    async ({ symbol }) => {
      // Simulate fetching price
      const prices: Record<string, number> = {
        BTC: 45000,
        ETH: 3000,
        SOL: 100,
      };
      return `Current price of ${symbol}: $${prices[symbol] || 'Unknown'}`;
    },
    {
      name: 'get_price',
      description: 'Get the current price of a cryptocurrency',
      schema: z.object({
        symbol: z.string().describe('The trading symbol (e.g., BTC, ETH)'),
      }),
    }
  );

  // Bind tools to model
  const client = new DeepSeekChatClient();
  const modelWithTools = client.bindTools([getPriceTool]);

  // Use the model with tools
  const response = await modelWithTools.invoke('What is the current price of BTC?');
  console.log('Response:', response);
}

// ============================================================================
// Example 7: Structured Output
// ============================================================================

async function example7_structuredOutput() {
  console.log('\n=== Example 7: Structured Output ===\n');

  const client = new DeepSeekChatClient();

  // Create structured output model
  const structuredModel = client.withStructuredOutput(TradingDecisionSchema);

  // Get structured decision
  const decision = await structuredModel.invoke(
    'Should I buy BTC at $45,000? Consider the current market conditions.'
  );

  console.log('Action:', decision.action);
  console.log('Confidence:', decision.confidence);
  console.log('Reasoning:', decision.reasoning);
  console.log('Position Size:', decision.positionSize);
  console.log('Stop Loss:', decision.stopLoss);
  console.log('Take Profit:', decision.takeProfit);
  console.log('Risk Level:', decision.riskLevel);
}

// ============================================================================
// Example 8: Using Preset Tools
// ============================================================================

async function example8_presetTools() {
  console.log('\n=== Example 8: Using Preset Tools ===\n');

  // Use preset tools
  const client = new DeepSeekChatClient();
  const modelWithTools = client.bindTools([getTraderInfoTool, analyzeRiskTool, getMarketDataTool]);

  const response = await modelWithTools.invoke(
    'Analyze the risk for a BTCUSDT trade with position size 1.5 BTC, entry price $45,000, and stop loss at $44,000.'
  );

  console.log('Response:', response);
}

// ============================================================================
// Example 9: Batch Processing
// ============================================================================

async function example9_batchProcessing() {
  console.log('\n=== Example 9: Batch Processing ===\n');

  const client = new DeepSeekChatClient();

  const prompts = [
    'What is 2+2?',
    'What is the capital of France?',
    'Explain momentum trading in one sentence.',
  ];

  const responses = await client.batchChat(prompts);

  responses.forEach((response, index) => {
    console.log(`Q${index + 1}: ${prompts[index]}`);
    console.log(`A${index + 1}: ${response}\n`);
  });
}

// ============================================================================
// Example 10: Configuration Management
// ============================================================================

async function example10_configuration() {
  console.log('\n=== Example 10: Configuration Management ===\n');

  // Create client with custom config
  const client = createDeepSeekChatClient({
    temperature: 0.2,
    maxTokens: 500,
  });

  console.log('Initial temperature:', client.getTemperature());
  console.log('Initial max tokens:', client.getMaxTokens());

  // Update configuration
  client.setTemperature(0.8);
  client.setMaxTokens(1000);

  console.log('Updated temperature:', client.getTemperature());
  console.log('Updated max tokens:', client.getMaxTokens());

  // Use the client
  const response = await client.chat('Generate a creative trading strategy name.');
  console.log('Response:', response);
}

// ============================================================================
// Example 11: Market Analysis with Structured Output
// ============================================================================

async function example11_marketAnalysis() {
  console.log('\n=== Example 11: Market Analysis ===\n');

  const client = new DeepSeekChatClient();
  const structuredModel = client.withStructuredOutput(MarketAnalysisSchema);

  const analysis = await structuredModel.invoke('Analyze BTCUSDT for a swing trading setup.');

  console.log('Symbol:', analysis.symbol);
  console.log('Trend:', analysis.trend);
  console.log('Support Levels:', analysis.supportLevels);
  console.log('Resistance Levels:', analysis.resistanceLevels);
  console.log('RSI:', analysis.indicators.rsi);
  console.log('MACD:', analysis.indicators.macd);
  console.log('Moving Averages:', analysis.indicators.movingAverages);
  console.log('Sentiment:', analysis.sentiment);
  console.log('Recommendation:', analysis.recommendation);
  console.log('Confidence:', analysis.confidence);
}

// ============================================================================
// Example 12: Trader Configuration Generation
// ============================================================================

async function example12_traderConfig() {
  console.log('\n=== Example 12: Trader Configuration ===\n');

  const client = new DeepSeekChatClient();
  const structuredModel = client.withStructuredOutput(TraderConfigSchema);

  const config = await structuredModel.invoke(
    'Create a conservative swing trading configuration for cryptocurrency markets.'
  );

  console.log('Name:', config.name);
  console.log('Strategy:', config.strategy);
  console.log('Risk Level:', config.riskLevel);
  console.log('Max Position Size:', config.maxPositionSize);
  console.log('Stop Loss %:', config.stopLossPercent);
  console.log('Take Profit %:', config.takeProfitPercent);
  console.log('Symbols:', config.symbols);
  console.log('Timeframe:', config.timeframe);
  console.log('Max Daily Trades:', config.maxDailyTrades);
  console.log('Use Leverage:', config.useLeverage);
  console.log('Description:', config.description);
}

// ============================================================================
// Example 13: Conversation History
// ============================================================================

async function example13_conversationHistory() {
  console.log('\n=== Example 13: Conversation History ===\n');

  const { HumanMessage, SystemMessage } = await import('@langchain/core/messages');
  const client = new DeepSeekChatClient();

  const messages = [
    new SystemMessage('You are a trading assistant.'),
    new HumanMessage('What is support and resistance?'),
    // You would add AI responses here in a real scenario
    new HumanMessage('Give me an example with BTC at $45,000.'),
  ];

  const response = await client.chatWithMessages(messages);
  console.log('Response:', response);
}

// ============================================================================
// Example 14: Answer Only (Reasoner)
// ============================================================================

async function example14_answerOnly() {
  console.log('\n=== Example 14: Answer Only ===\n');

  const client = new DeepSeekReasonerClient();

  // Get only the final answer (skip reasoning)
  const answer = await client.answerOnly('What is 15% of $1,250?');
  console.log('Answer:', answer);
}

// ============================================================================
// Example 15: Reasoning Only (Reasoner)
// ============================================================================

async function example15_reasoningOnly() {
  console.log('\n=== Example 15: Reasoning Only ===\n');

  const client = new DeepSeekReasonerClient();

  // Get only the reasoning process
  const reasoning = await client.reasoningOnly('Should I use a stop loss or take profit first?');
  console.log('Reasoning:', reasoning);
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log('DeepSeek LangChain Module Examples\n');
  console.log('====================================\n');

  // Uncomment the examples you want to run:

  // await example1_basicChat();
  // await example2_chatWithSystemPrompt();
  // await example3_streamingChat();
  // await example4_basicReasoner();
  // await example5_streamingReasoner();
  // await example6_toolCalling();
  // await example7_structuredOutput();
  // await example8_presetTools();
  // await example9_batchProcessing();
  // await example10_configuration();
  // await example11_marketAnalysis();
  // await example12_traderConfig();
  // await example13_conversationHistory();
  // await example14_answerOnly();
  // await example15_reasoningOnly();

  console.log('\n=== Examples Complete ===\n');
}

// Export for use in other files
export {
  example1_basicChat,
  example2_chatWithSystemPrompt,
  example3_streamingChat,
  example4_basicReasoner,
  example5_streamingReasoner,
  example6_toolCalling,
  example7_structuredOutput,
  example8_presetTools,
  example9_batchProcessing,
  example10_configuration,
  example11_marketAnalysis,
  example12_traderConfig,
  example13_conversationHistory,
  example14_answerOnly,
  example15_reasoningOnly,
};

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}
