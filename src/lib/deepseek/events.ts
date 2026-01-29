/**
 * Event bus for DeepSeek monitoring
 * Centralized event management for all DeepSeek API calls
 */

import { EventEmitter } from 'events';
import type {
  DeepSeekCallEvent,
  EventListener,
  EventSubscription,
  DeepSeekEventChunk,
  DeepSeekEventCompletion,
  DeepSeekEventError,
  ModelType,
  CallType,
} from './monitor-types';

/**
 * Event bus singleton for DeepSeek monitoring
 */
class DeepSeekEventBus extends EventEmitter {
  private static instance: DeepSeekEventBus;
  private eventBuffer: DeepSeekCallEvent[] = [];
  private readonly maxBufferSize = 1000;
  private subscriberCount = 0;
  private eventIdCounter = 0;

  private constructor() {
    super();
    this.setMaxListeners(100); // Allow many listeners
  }

  /**
   * Get singleton instance
   */
  static getInstance(): DeepSeekEventBus {
    if (!DeepSeekEventBus.instance) {
      DeepSeekEventBus.instance = new DeepSeekEventBus();
    }
    return DeepSeekEventBus.instance;
  }

  /**
   * Generate unique event ID
   */
  private generateEventId(): string {
    return `event-${Date.now()}-${++this.eventIdCounter}`;
  }

  /**
   * Emit a call started event
   */
  emitCallStarted(event: Omit<DeepSeekCallEvent, 'eventId' | 'timestamp' | 'status'>): {
    eventId: string;
    fullEvent: DeepSeekCallEvent;
  } {
    const eventId = this.generateEventId();
    const fullEvent: DeepSeekCallEvent = {
      eventId,
      timestamp: Date.now(),
      status: 'started',
      ...event,
    };

    this.addToBuffer(fullEvent);
    this.emit('call.started', fullEvent);

    return { eventId, fullEvent };
  }

  /**
   * Emit a streaming chunk event
   */
  emitCallChunk(eventId: string, chunk: DeepSeekEventChunk): void {
    // Get original event from buffer to preserve context
    const originalEvent = this.eventBuffer.find((e) => e.eventId === eventId);

    const event: DeepSeekCallEvent = {
      eventId,
      timestamp: chunk.timestamp,
      modelType: originalEvent?.modelType || 'deepseek-chat',
      callType: originalEvent?.callType || 'chat-stream',
      userPrompt: originalEvent?.userPrompt || '',
      systemPrompt: originalEvent?.systemPrompt,
      temperature: originalEvent?.temperature,
      maxTokens: originalEvent?.maxTokens,
      status: 'streaming',
      content: chunk.content,
      metadata: chunk.isReasoning ? { reasoningContent: chunk.content } : originalEvent?.metadata,
    };

    // Debug logging
    console.log('[EventBus] Emitting chunk:', {
      eventId,
      contentLength: chunk.content.length,
      contentPreview: chunk.content.substring(0, 50),
      subscriberCount: this.subscriberCount,
    });

    this.emit('call.chunk', event);
  }

  /**
   * Emit a call completed event
   */
  emitCallCompleted(
    completion: DeepSeekEventCompletion & {
      content?: string;
      modelType?: string;
      callType?: string;
      metadata?: Record<string, unknown>;
    }
  ): void {
    // Get the original event from buffer to preserve context
    const originalEvent = this.eventBuffer.find((e) => e.eventId === completion.eventId);

    const event: DeepSeekCallEvent = {
      eventId: completion.eventId,
      timestamp: completion.timestamp,
      modelType: (originalEvent?.modelType || completion.modelType || 'deepseek-chat') as ModelType,
      callType: (originalEvent?.callType || completion.callType || 'chat') as CallType,
      userPrompt: originalEvent?.userPrompt || '',
      systemPrompt: originalEvent?.systemPrompt,
      temperature: originalEvent?.temperature,
      maxTokens: originalEvent?.maxTokens,
      status: 'completed',
      content: completion.content,
      metadata: {
        duration: completion.duration,
        tokensUsed: completion.tokensUsed,
        ...completion.metadata,
      },
    };

    this.updateBufferWithEvent(completion.eventId, event);
    this.emit('call.completed', event);
  }

  /**
   * Emit a call error event
   */
  emitCallError(errorData: DeepSeekEventError): void {
    const event: DeepSeekCallEvent = {
      eventId: errorData.eventId,
      timestamp: errorData.timestamp,
      modelType: 'deepseek-chat',
      callType: 'chat',
      userPrompt: '',
      status: 'error',
      error: errorData.error,
    };

    this.updateBufferStatus(errorData.eventId, 'error');
    this.emit('call.error', event);
  }

  /**
   * Subscribe to all events
   */
  subscribe(listener: EventListener): EventSubscription {
    this.subscriberCount++;

    const wrappedListener = (event: DeepSeekCallEvent) => {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in event listener:', error);
      }
    };

    this.on('call.started', wrappedListener);
    this.on('call.chunk', wrappedListener);
    this.on('call.completed', wrappedListener);
    this.on('call.error', wrappedListener);

    return {
      unsubscribe: () => {
        this.subscriberCount--;
        this.off('call.started', wrappedListener);
        this.off('call.chunk', wrappedListener);
        this.off('call.completed', wrappedListener);
        this.off('call.error', wrappedListener);
      },
    };
  }

  /**
   * Subscribe to specific event type
   */
  subscribeTo(eventType: string, listener: EventListener): EventSubscription {
    this.subscriberCount++;

    const wrappedListener = (event: DeepSeekCallEvent) => {
      try {
        listener(event);
      } catch (error) {
        console.error(`Error in ${eventType} listener:`, error);
      }
    };

    this.on(eventType, wrappedListener);

    return {
      unsubscribe: () => {
        this.subscriberCount--;
        this.off(eventType, wrappedListener);
      },
    };
  }

  /**
   * Get recent events from buffer
   */
  getRecentEvents(limit: number = 100): DeepSeekCallEvent[] {
    return this.eventBuffer.slice(-limit);
  }

  /**
   * Clear event buffer
   */
  clearBuffer(): void {
    this.eventBuffer = [];
  }

  /**
   * Get subscriber count
   */
  getSubscriberCount(): number {
    return this.subscriberCount;
  }

  /**
   * Add event to buffer
   */
  private addToBuffer(event: DeepSeekCallEvent): void {
    this.eventBuffer.push(event);

    // Keep buffer size under limit
    if (this.eventBuffer.length > this.maxBufferSize) {
      this.eventBuffer = this.eventBuffer.slice(-this.maxBufferSize);
    }
  }

  /**
   * Update event status in buffer
   */
  private updateBufferStatus(
    eventId: string,
    status: 'completed' | 'error',
    duration?: number
  ): void {
    const event = this.eventBuffer.find((e) => e.eventId === eventId);
    if (event) {
      event.status = status;
      if (duration) {
        event.metadata = event.metadata || {};
        event.metadata.duration = duration;
      }
    }
  }

  /**
   * Update entire event in buffer
   */
  private updateBufferWithEvent(eventId: string, updatedEvent: DeepSeekCallEvent): void {
    const index = this.eventBuffer.findIndex((e) => e.eventId === eventId);
    if (index >= 0) {
      this.eventBuffer[index] = updatedEvent;
    }
  }
}

/**
 * Export singleton instance
 */
export const eventBus = DeepSeekEventBus.getInstance();

/**
 * Export class for testing
 */
export { DeepSeekEventBus };
