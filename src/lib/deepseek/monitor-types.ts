/**
 * Event types for DeepSeek monitoring system
 */

/**
 * Event status enumeration
 */
export type EventStatus = 'started' | 'streaming' | 'completed' | 'error';

/**
 * Model type enumeration
 */
export type ModelType = 'deepseek-chat' | 'deepseek-reasoner';

/**
 * Call type enumeration
 */
export type CallType = 'chat' | 'reasoner' | 'chat-stream' | 'reasoner-stream';

/**
 * Main event interface for monitoring DeepSeek calls
 */
export interface DeepSeekCallEvent {
  eventId: string;
  timestamp: number;
  modelType: ModelType;
  callType: CallType;
  systemPrompt?: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
  status: EventStatus;
  content?: string;
  error?: string;
  metadata?: {
    duration?: number;
    tokensUsed?: number;
    reasoningContent?: string;
  };
}

/**
 * Event chunk for streaming updates
 */
export interface DeepSeekEventChunk {
  eventId: string;
  content: string;
  timestamp: number;
  isReasoning?: boolean;
}

/**
 * Event completion data
 */
export interface DeepSeekEventCompletion {
  eventId: string;
  duration: number;
  timestamp: number;
  tokensUsed?: number;
}

/**
 * Event error data
 */
export interface DeepSeekEventError {
  eventId: string;
  error: string;
  timestamp: number;
}

/**
 * SSE event types
 */
export interface SSEEvent {
  event: string;
  data: unknown;
}

/**
 * Event listener type
 */
export type EventListener = (event: DeepSeekCallEvent) => void;

/**
 * Subscription handle for unsubscribing
 */
export interface EventSubscription {
  unsubscribe: () => void;
}
