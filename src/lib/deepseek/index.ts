/**
 * DeepSeek LangChain Module
 *
 * A modern, LangChain-based implementation for interacting with DeepSeek API.
 * Supports both chat and reasoner modes with tool calling, structured output, and streaming.
 *
 * @example
 * ```typescript
 * import { callDeepSeekChat, callDeepSeekReasoner } from '@/lib/deepseek';
 *
 * // Chat mode
 * const chatResponse = await callDeepSeekChat('Hello!');
 *
 * // Reasoner mode
 * const { reasoning, answer } = await callDeepSeekReasoner('What is 2+2?');
 * ```
 */

// ============================================================================
// Core Classes
// ============================================================================

export { DeepSeekLangChainClient } from './core';
export { DeepSeekChatClient } from './chat';
export { DeepSeekReasonerClient } from './reasoner';

// ============================================================================
// Types
// ============================================================================

export type {
  DeepSeekModelType,
  BaseDeepSeekConfig,
  DeepSeekChatConfig,
  DeepSeekReasonerConfig,
  DeepSeekMessage,
  ReasonerResponse,
  StreamChunk,
  DeepSeekTool,
  StructuredOutputSchema,
  ReasonerStreamChunk,
  ToolCallResult,
  ChatOptions,
  ReasonerOptions,
} from './types';

// ============================================================================
// Tools & Schemas
// ============================================================================

export {
  getTraderInfoTool,
  analyzeRiskTool,
  getMarketDataTool,
  createTraderTool,
  defaultTools,
  toolCategories,
  createCustomTool,
  getSchemaJson,
  validateAgainstSchema,
  safeValidateAgainstSchema,
} from './tools';

export type { TradingDecision, MarketAnalysis, TraderConfig, RiskAssessment } from './tools';

export {
  TradingDecisionSchema,
  MarketAnalysisSchema,
  TraderConfigSchema,
  RiskAssessmentSchema,
} from './tools';

// ============================================================================
// Utilities
// ============================================================================

export {
  createDeepSeekClient,
  createDeepSeekChatClient,
  createDeepSeekReasonerClient,
  quickChat,
  quickReasoner,
  streamChat,
  streamReasoner,
  mergeConfigs,
  isValidApiKeyFormat,
  getModelType,
  supportsToolCalling,
  supportsStructuredOutput,
  supportsReasoning,
  getModelCapabilities,
  withRetry,
  formatErrorMessage,
  debounce,
  throttle,
} from './utils';

// ============================================================================
// AI Trader Generation
// ============================================================================

export {
  generateSingleTrader,
  generateMultipleTraders,
  TRADER_GENERATION_SYSTEM_PROMPT,
  type TraderWithRelations,
} from './generate-trader';

// ============================================================================
// Configuration
// ============================================================================

export { deepSeekConfig, getApiKey, validateApiKey, getModelDefaults } from './config';

// ============================================================================
// Singleton Instances
// ============================================================================

import { DeepSeekChatClient } from './chat';
import { DeepSeekReasonerClient } from './reasoner';

/**
 * Default chat client singleton
 * Uses default configuration and DEEPSEEK_API_KEY environment variable
 */
export const deepSeekChatClient = new DeepSeekChatClient();

/**
 * Default reasoner client singleton
 * Uses default configuration and DEEPSEEK_API_KEY environment variable
 */
export const deepSeekReasonerClient = new DeepSeekReasonerClient();

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Quick chat function using default client
 * @param userPrompt - The user's prompt
 * @param systemPrompt - Optional system prompt
 * @returns The model's response
 *
 * @example
 * ```typescript
 * const response = await callDeepSeekChat('Explain quantum computing');
 * ```
 */
export async function callDeepSeekChat(userPrompt: string, systemPrompt?: string): Promise<string> {
  return deepSeekChatClient.chat(userPrompt, systemPrompt);
}

/**
 * Quick reasoner function using default client
 * @param userPrompt - The user's prompt
 * @param systemPrompt - Optional system prompt
 * @returns Object containing reasoning and answer
 *
 * @example
 * ```typescript
 * const { reasoning, answer } = await callDeepSeekReasoner('Solve: x + 2 = 5');
 * console.log(reasoning); // Shows the step-by-step reasoning
 * console.log(answer); // Shows the final answer
 * ```
 */
export async function callDeepSeekReasoner(
  userPrompt: string,
  systemPrompt?: string
): Promise<{ reasoning: string; answer: string }> {
  return deepSeekReasonerClient.reasoner(userPrompt, systemPrompt);
}

/**
 * Stream chat using default client
 * @param userPrompt - The user's prompt
 * @param systemPrompt - Optional system prompt
 * @returns Async generator yielding response chunks
 *
 * @example
 * ```typescript
 * for await (const chunk of streamDeepSeekChat('Tell me a story')) {
 *   process.stdout.write(chunk);
 * }
 * ```
 */
export async function* streamDeepSeekChat(
  userPrompt: string,
  systemPrompt?: string
): AsyncGenerator<string> {
  yield* deepSeekChatClient.chatStream(userPrompt, systemPrompt);
}

/**
 * Stream reasoner using default client
 * @param userPrompt - The user's prompt
 * @param systemPrompt - Optional system prompt
 * @returns Async generator yielding typed chunks
 *
 * @example
 * ```typescript
 * for await (const chunk of streamDeepSeekReasoner('Why is the sky blue?')) {
 *   if (chunk.type === 'reasoning') {
 *     console.log('Thinking:', chunk.content);
 *   } else {
 *     console.log('Answer:', chunk.content);
 *   }
 * }
 * ```
 */
export async function* streamDeepSeekReasoner(
  userPrompt: string,
  systemPrompt?: string
): AsyncGenerator<{ type: 'reasoning' | 'answer'; content: string }> {
  yield* deepSeekReasonerClient.reasonerStream(userPrompt, systemPrompt);
}

// ============================================================================
// Backward Compatibility - Legacy API
// ============================================================================

/**
 * @deprecated Use `callDeepSeekChat` or `DeepSeekChatClient` instead
 *
 * Legacy function for backward compatibility
 * @deprecated This will be removed in a future version. Migrate to the new API.
 */
export async function callDeepSeek(options: {
  model?: 'deepseek-chat' | 'deepseek-reasoner';
  systemPrompt?: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
}): Promise<string> {
  console.warn(
    '[Deprecation Warning] callDeepSeek is deprecated. Use callDeepSeekChat or callDeepSeekReasoner instead.'
  );

  const { model = 'deepseek-chat', systemPrompt, userPrompt, temperature, maxTokens } = options;

  if (model === 'deepseek-reasoner') {
    const result = await deepSeekReasonerClient.reasoner(userPrompt, systemPrompt);
    return result.answer;
  }

  const client = new DeepSeekChatClient({ temperature, maxTokens });
  return client.chat(userPrompt, systemPrompt);
}

/**
 * @deprecated Use `callDeepSeekChat` instead
 *
 * Legacy function for backward compatibility
 * @deprecated This will be removed in a future version. Use callDeepSeekChat instead.
 */
export async function callDeepSeekChatMode(options: {
  systemPrompt?: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
}): Promise<string> {
  console.warn(
    '[Deprecation Warning] callDeepSeekChatMode is deprecated. Use callDeepSeekChat instead.'
  );

  const { systemPrompt, userPrompt, temperature, maxTokens } = options;
  const client = new DeepSeekChatClient({ temperature, maxTokens });
  return client.chat(userPrompt, systemPrompt);
}

/**
 * @deprecated Use `callDeepSeekReasoner` instead
 *
 * Legacy function for backward compatibility
 * @deprecated This will be removed in a future version. Use callDeepSeekReasoner instead.
 */
export async function callDeepSeekReasonerMode(options: {
  systemPrompt?: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
}): Promise<{ reasoning: string; answer: string }> {
  console.warn(
    '[Deprecation Warning] callDeepSeekReasonerMode is deprecated. Use callDeepSeekReasoner instead.'
  );

  const { systemPrompt, userPrompt, temperature, maxTokens } = options;
  const client = new DeepSeekReasonerClient({ temperature, maxTokens });
  return client.reasoner(userPrompt, systemPrompt);
}

// ============================================================================
// Re-exports for legacy module
// ============================================================================

/**
 * Legacy client class for backward compatibility
 * @deprecated Use DeepSeekChatClient or DeepSeekReasonerClient instead
 */
export class DeepSeekClient {
  private chatClient: DeepSeekChatClient;
  private reasonerClient: DeepSeekReasonerClient;

  constructor(apiKey?: string) {
    this.chatClient = new DeepSeekChatClient(apiKey ? { apiKey } : undefined);
    this.reasonerClient = new DeepSeekReasonerClient(apiKey ? { apiKey } : undefined);
  }

  async chat(options: {
    model?: 'deepseek-chat' | 'deepseek-reasoner';
    systemPrompt?: string;
    userPrompt: string;
    temperature?: number;
    maxTokens?: number;
  }): Promise<string> {
    console.warn(
      '[Deprecation Warning] DeepSeekClient.chat is deprecated. Use DeepSeekChatClient or DeepSeekReasonerClient instead.'
    );

    const { model = 'deepseek-chat', systemPrompt, userPrompt, temperature, maxTokens } = options;

    if (temperature !== undefined) {
      this.chatClient.setTemperature(temperature);
      this.reasonerClient.setTemperature(temperature);
    }
    if (maxTokens !== undefined) {
      this.chatClient.setMaxTokens(maxTokens);
      this.reasonerClient.setMaxTokens(maxTokens);
    }

    if (model === 'deepseek-reasoner') {
      const result = await this.reasonerClient.reasoner(userPrompt, systemPrompt);
      return result.answer;
    }

    return this.chatClient.chat(userPrompt, systemPrompt);
  }

  async chatMode(options: {
    systemPrompt?: string;
    userPrompt: string;
    temperature?: number;
    maxTokens?: number;
  }): Promise<string> {
    return this.chat({ ...options, model: 'deepseek-chat' });
  }

  async reasonerMode(options: {
    systemPrompt?: string;
    userPrompt: string;
    temperature?: number;
    maxTokens?: number;
  }): Promise<{ reasoning: string; answer: string }> {
    const { systemPrompt, userPrompt, temperature, maxTokens } = options;

    if (temperature !== undefined) {
      this.reasonerClient.setTemperature(temperature);
    }
    if (maxTokens !== undefined) {
      this.reasonerClient.setMaxTokens(maxTokens);
    }

    return this.reasonerClient.reasoner(userPrompt, systemPrompt);
  }

  setApiKey(apiKey: string): void {
    this.chatClient.setApiKey(apiKey);
    this.reasonerClient.setApiKey(apiKey);
  }
}

/**
 * Legacy singleton for backward compatibility
 * @deprecated Use deepSeekChatClient or deepSeekReasonerClient instead
 */
export const deepSeekClient = new DeepSeekClient();
