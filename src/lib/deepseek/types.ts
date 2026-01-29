/**
 * DeepSeek Model Types
 * Defines supported model types for different use cases
 */
export type DeepSeekModelType = 'deepseek-chat' | 'deepseek-reasoner';

/**
 * Base configuration for DeepSeek clients
 */
export interface BaseDeepSeekConfig {
  /**
   * API key for DeepSeek API
   * If not provided, will use DEEPSEEK_API_KEY environment variable
   */
  apiKey?: string;

  /**
   * Model to use
   * @default 'deepseek-chat'
   */
  model?: DeepSeekModelType;

  /**
   * Temperature for response generation (0-2)
   * @default 0.7
   */
  temperature?: number;

  /**
   * Maximum tokens to generate
   */
  maxTokens?: number;

  /**
   * Base URL for API requests
   * @default 'https://api.deepseek.com'
   */
  baseURL?: string;
}

/**
 * Configuration specific to Chat mode
 */
export interface DeepSeekChatConfig extends BaseDeepSeekConfig {
  /**
   * Model type for chat mode
   * @default 'deepseek-chat'
   */
  model?: 'deepseek-chat';

  /**
   * Enable streaming responses
   * @default false
   */
  streaming?: boolean;
}

/**
 * Configuration specific to Reasoner mode
 */
export interface DeepSeekReasonerConfig extends BaseDeepSeekConfig {
  /**
   * Model type for reasoner mode
   * @default 'deepseek-reasoner'
   */
  model?: 'deepseek-reasoner';

  /**
   * Enable streaming responses
   * @default false
   */
  streaming?: boolean;
}

/**
 * Chat message interface
 */
export interface DeepSeekMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Response from Reasoner mode
 */
export interface ReasonerResponse {
  /**
   * The reasoning chain/thought process
   */
  reasoning: string;

  /**
   * The final answer
   */
  answer: string;
}

/**
 * Stream chunk type for streaming responses
 */
export type StreamChunk = string;

/**
 * Tool definition interface for tool calling
 */
export interface DeepSeekTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

/**
 * Structured output schema type
 * Can be a Zod schema or a JSON schema
 */
export type StructuredOutputSchema<T> = {
  type: 'object';
  properties: Record<string, { type: string; description?: string }>;
  required?: string[];
  zod?: import('zod').ZodType<T>;
};

/**
 * Reasoner stream chunk with phase information
 */
export interface ReasonerStreamChunk {
  type: 'reasoning' | 'answer';
  content: string;
}

/**
 * Tool call result
 */
export interface ToolCallResult {
  tool: string;
  toolInput: Record<string, unknown>;
  output?: string;
  error?: string;
}

/**
 * Chat options for backward compatibility
 */
export interface ChatOptions {
  systemPrompt?: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  outputTemplate?: string;
}

/**
 * Reasoner options for backward compatibility
 */
export interface ReasonerOptions {
  systemPrompt?: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}
