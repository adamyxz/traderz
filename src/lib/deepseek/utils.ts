import { DeepSeekChatClient } from './chat';
import { DeepSeekReasonerClient } from './reasoner';
import type { DeepSeekChatConfig, DeepSeekReasonerConfig } from './types';

/**
 * Factory function to create a DeepSeek chat client
 * @param config - Configuration for the chat client
 * @returns Configured DeepSeekChatClient instance
 */
export function createDeepSeekChatClient(config?: DeepSeekChatConfig): DeepSeekChatClient {
  return new DeepSeekChatClient(config);
}

/**
 * Factory function to create a DeepSeek reasoner client
 * @param config - Configuration for the reasoner client
 * @returns Configured DeepSeekReasonerClient instance
 */
export function createDeepSeekReasonerClient(
  config?: DeepSeekReasonerConfig
): DeepSeekReasonerClient {
  return new DeepSeekReasonerClient(config);
}

/**
 * Generic factory function to create any DeepSeek client
 * @param modelType - Type of model ('deepseek-chat' or 'deepseek-reasoner')
 * @param config - Configuration options
 * @returns Configured client instance
 */
export function createDeepSeekClient(
  modelType: 'deepseek-chat',
  config?: DeepSeekChatConfig
): DeepSeekChatClient;
export function createDeepSeekClient(
  modelType: 'deepseek-reasoner',
  config?: DeepSeekReasonerConfig
): DeepSeekReasonerClient;
export function createDeepSeekClient(
  modelType: 'deepseek-chat' | 'deepseek-reasoner',
  config?: DeepSeekChatConfig | DeepSeekReasonerConfig
): DeepSeekChatClient | DeepSeekReasonerClient {
  if (modelType === 'deepseek-chat') {
    return new DeepSeekChatClient(config as DeepSeekChatConfig);
  } else {
    return new DeepSeekReasonerClient(config as DeepSeekReasonerConfig);
  }
}

/**
 * Quick chat function - one-shot chat without creating a client
 * @param prompt - The user prompt
 * @param systemPrompt - Optional system prompt
 * @param config - Optional configuration
 * @returns The model's response
 */
export async function quickChat(
  prompt: string,
  systemPrompt?: string,
  config?: DeepSeekChatConfig
): Promise<string> {
  const client = new DeepSeekChatClient(config);
  return client.chat(prompt, systemPrompt);
}

/**
 * Quick reasoner function - one-shot reasoning without creating a client
 * @param prompt - The user prompt
 * @param systemPrompt - Optional system prompt
 * @param config - Optional configuration
 * @returns Object containing reasoning and answer
 */
export async function quickReasoner(
  prompt: string,
  systemPrompt?: string,
  config?: DeepSeekReasonerConfig
): Promise<{ reasoning: string; answer: string }> {
  const client = new DeepSeekReasonerClient(config);
  return client.reasoner(prompt, systemPrompt);
}

/**
 * Stream chat function - streaming chat without creating a client
 * @param prompt - The user prompt
 * @param systemPrompt - Optional system prompt
 * @param config - Optional configuration
 * @returns Async generator yielding response chunks
 */
export async function* streamChat(
  prompt: string,
  systemPrompt?: string,
  config?: DeepSeekChatConfig
): AsyncGenerator<string> {
  const client = new DeepSeekChatClient(config);
  yield* client.chatStream(prompt, systemPrompt);
}

/**
 * Stream reasoner function - streaming reasoning without creating a client
 * @param prompt - The user prompt
 * @param systemPrompt - Optional system prompt
 * @param config - Optional configuration
 * @returns Async generator yielding typed chunks
 */
export async function* streamReasoner(
  prompt: string,
  systemPrompt?: string,
  config?: DeepSeekReasonerConfig
): AsyncGenerator<{ type: 'reasoning' | 'answer'; content: string }> {
  const client = new DeepSeekReasonerClient(config);
  yield* client.reasonerStream(prompt, systemPrompt);
}

/**
 * Merge configurations with precedence
 * Later configs override earlier ones
 */
export function mergeConfigs<T extends Record<string, unknown>>(
  ...configs: (Partial<T> | undefined)[]
): Partial<T> {
  return configs.reduce<Partial<T>>((acc, config) => {
    if (config) {
      return { ...acc, ...config };
    }
    return acc;
  }, {});
}

/**
 * Validate API key format
 * DeepSeek API keys typically start with 'sk-'
 */
export function isValidApiKeyFormat(apiKey: string): boolean {
  // Basic format check
  return apiKey.length > 0 && apiKey.startsWith('sk-');
}

/**
 * Extract model type from model string
 */
export function getModelType(model: string): 'deepseek-chat' | 'deepseek-reasoner' {
  if (model === 'deepseek-reasoner') {
    return 'deepseek-reasoner';
  }
  return 'deepseek-chat';
}

/**
 * Check if model supports tool calling
 */
export function supportsToolCalling(model: string): boolean {
  return model === 'deepseek-chat';
}

/**
 * Check if model supports structured output
 */
export function supportsStructuredOutput(model: string): boolean {
  return model === 'deepseek-chat';
}

/**
 * Check if model supports reasoning
 */
export function supportsReasoning(model: string): boolean {
  return model === 'deepseek-reasoner';
}

/**
 * Get model capabilities
 */
export function getModelCapabilities(model: string): {
  toolCalling: boolean;
  structuredOutput: boolean;
  reasoning: boolean;
  streaming: boolean;
} {
  return {
    toolCalling: supportsToolCalling(model),
    structuredOutput: supportsStructuredOutput(model),
    reasoning: supportsReasoning(model),
    streaming: true, // All models support streaming
  };
}

/**
 * Create a retry wrapper for API calls
 * @param fn - The function to retry
 * @param maxRetries - Maximum number of retries
 * @param delay - Delay between retries in milliseconds
 * @returns Function with retry logic
 */
export function withRetry<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  maxRetries: number = 3,
  delay: number = 1000
): T {
  return (async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    let lastError: Error | undefined;

    for (let i = 0; i <= maxRetries; i++) {
      try {
        return (await fn(...args)) as ReturnType<T>;
      } catch (error) {
        lastError = error as Error;

        // Don't retry on certain errors
        if (error instanceof Error) {
          if (error.message.includes('API key')) {
            throw error;
          }
          if (error.message.includes('authentication')) {
            throw error;
          }
        }

        // Wait before retrying (except on last attempt)
        if (i < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, delay * (i + 1)));
        }
      }
    }

    throw lastError || new Error('Unknown error in retry wrapper');
  }) as T;
}

/**
 * Format error message from API error
 */
export function formatErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message);
  }
  return 'Unknown error occurred';
}

/**
 * Create a debounced version of a function
 * @param fn - Function to debounce
 * @param delay - Delay in milliseconds
 * @returns Debounced function
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout | undefined;

  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Create a throttled version of a function
 * @param fn - Function to throttle
 * @param limit - Minimum time between calls in milliseconds
 * @returns Throttled function
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  fn: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;

  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}
