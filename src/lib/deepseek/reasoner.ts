import { BaseMessage } from '@langchain/core/messages';
import { DeepSeekLangChainClient } from './core';
import type { DeepSeekReasonerConfig, ReasonerResponse, ReasonerStreamChunk } from './types';
import { eventBus } from './events';

/**
 * Reasoner mode client for DeepSeek
 * Provides access to reasoning chain and final answer
 */
export class DeepSeekReasonerClient extends DeepSeekLangChainClient {
  constructor(config: DeepSeekReasonerConfig = {}) {
    super({
      ...config,
      model: config.model || 'deepseek-reasoner',
    });
  }

  /**
   * Invoke reasoner mode and get both reasoning and answer
   * @param userPrompt - The user's prompt
   * @param systemPrompt - Optional system prompt
   * @returns Object containing reasoning and answer
   */
  async reasoner(userPrompt: string, systemPrompt?: string): Promise<ReasonerResponse> {
    this.validateApiKey();

    const startTime = Date.now();
    const { eventId } = eventBus.emitCallStarted({
      modelType: this.modelType,
      callType: 'reasoner',
      systemPrompt,
      userPrompt,
      temperature: this.temperature,
      maxTokens: this.maxTokens,
    });

    const model = this.getModel();
    const messages = this.prepareMessages(systemPrompt, userPrompt);

    try {
      const response = await model.invoke(messages);
      const duration = Date.now() - startTime;

      // Try to extract reasoning from response metadata or additional_kwargs
      const reasoning = this.extractReasoning(response);
      const answer = this.extractAnswer(response);

      eventBus.emitCallCompleted({
        eventId,
        duration,
        timestamp: Date.now(),
        content: answer,
        metadata: {
          duration,
          reasoningContent: reasoning,
        },
      });

      return {
        reasoning,
        answer,
      };
    } catch (error) {
      eventBus.emitCallError({
        eventId,
        error: error instanceof Error ? error.message : String(error),
        timestamp: Date.now(),
      });
      throw error;
    }
  }

  /**
   * Stream reasoner responses
   * Yields chunks with type information ('reasoning' or 'answer')
   * @param userPrompt - The user's prompt
   * @param systemPrompt - Optional system prompt
   * @returns Async generator yielding typed chunks
   */
  async *reasonerStream(
    userPrompt: string,
    systemPrompt?: string
  ): AsyncGenerator<ReasonerStreamChunk> {
    this.validateApiKey();

    const startTime = Date.now();
    const { eventId } = eventBus.emitCallStarted({
      modelType: this.modelType,
      callType: 'reasoner-stream',
      systemPrompt,
      userPrompt,
      temperature: this.temperature,
      maxTokens: this.maxTokens,
    });

    const model = this.getModel();
    const messages = this.prepareMessages(systemPrompt, userPrompt);
    let fullReasoning = '';
    let fullAnswer = '';

    try {
      const stream = await model.stream(messages);

      for await (const chunk of stream) {
        // Check if this chunk contains reasoning
        const reasoning = this.extractReasoning(chunk);
        if (reasoning) {
          fullReasoning += reasoning;
          eventBus.emitCallChunk(eventId, {
            eventId,
            content: reasoning,
            timestamp: Date.now(),
            isReasoning: true,
          });
          yield {
            type: 'reasoning',
            content: reasoning,
          };
        }

        // Check if this chunk contains answer
        const answer = this.extractAnswer(chunk);
        if (answer) {
          fullAnswer += answer;
          eventBus.emitCallChunk(eventId, {
            eventId,
            content: answer,
            timestamp: Date.now(),
            isReasoning: false,
          });
          yield {
            type: 'answer',
            content: answer,
          };
        }
      }

      const duration = Date.now() - startTime;
      eventBus.emitCallCompleted({
        eventId,
        duration,
        timestamp: Date.now(),
        content: fullAnswer,
        metadata: {
          duration,
          reasoningContent: fullReasoning,
        },
      });
    } catch (error) {
      eventBus.emitCallError({
        eventId,
        error: error instanceof Error ? error.message : String(error),
        timestamp: Date.now(),
      });
      throw error;
    }
  }

  /**
   * Get only the final answer (without reasoning)
   * @param userPrompt - The user's prompt
   * @param systemPrompt - Optional system prompt
   * @returns The final answer as a string
   */
  async answerOnly(userPrompt: string, systemPrompt?: string): Promise<string> {
    const result = await this.reasoner(userPrompt, systemPrompt);
    return result.answer;
  }

  /**
   * Get only the reasoning (without final answer)
   * @param userPrompt - The user's prompt
   * @param systemPrompt - Optional system prompt
   * @returns The reasoning as a string
   */
  async reasoningOnly(userPrompt: string, systemPrompt?: string): Promise<string> {
    const result = await this.reasoner(userPrompt, systemPrompt);
    return result.reasoning;
  }

  /**
   * Extract reasoning from a response
   * DeepSeek reasoner returns reasoning in reasoning_content field
   */
  private extractReasoning(response: unknown): string {
    // Check additional_kwargs for reasoning_content
    const resp = response as Record<string, unknown>;
    if (resp?.additional_kwargs && typeof resp.additional_kwargs === 'object') {
      const kwargs = resp.additional_kwargs as Record<string, unknown>;
      if (kwargs.reasoning_content && typeof kwargs.reasoning_content === 'string') {
        return kwargs.reasoning_content;
      }
    }

    // Check if response itself has reasoning_content
    if (resp?.reasoning_content && typeof resp.reasoning_content === 'string') {
      return resp.reasoning_content;
    }

    // Try to extract from content if it's a structured response
    const content = resp?.content;
    if (typeof content === 'string') {
      return content;
    }

    return '';
  }

  /**
   * Extract answer from a response
   */
  private extractAnswer(response: unknown): string {
    // Main content is usually the answer
    const resp = response as Record<string, unknown>;
    const content = resp?.content;

    if (typeof content === 'string') {
      return content;
    }

    // If content is an array or object, try to stringify
    if (content) {
      try {
        return JSON.stringify(content);
      } catch {
        return String(content);
      }
    }

    return '';
  }

  /**
   * Batch processing for reasoner mode
   * @param prompts - Array of prompts
   * @param systemPrompt - Optional system prompt for all prompts
   * @returns Array of reasoning responses
   */
  async batchReasoner(prompts: string[], systemPrompt?: string): Promise<ReasonerResponse[]> {
    this.validateApiKey();

    const model = this.getModel();
    const messageBatches = prompts.map((prompt) => this.prepareMessages(systemPrompt, prompt));

    const results = await model.batch(messageBatches);

    return results.map((result) => ({
      reasoning: this.extractReasoning(result),
      answer: this.extractAnswer(result),
    }));
  }

  /**
   * Stream reasoning only
   * @param userPrompt - The user's prompt
   * @param systemPrompt - Optional system prompt
   * @returns Async generator yielding reasoning chunks
   */
  async *streamReasoningOnly(userPrompt: string, systemPrompt?: string): AsyncGenerator<string> {
    for await (const chunk of this.reasonerStream(userPrompt, systemPrompt)) {
      if (chunk.type === 'reasoning') {
        yield chunk.content;
      }
    }
  }

  /**
   * Stream answer only
   * @param userPrompt - The user's prompt
   * @param systemPrompt - Optional system prompt
   * @returns Async generator yielding answer chunks
   */
  async *streamAnswerOnly(userPrompt: string, systemPrompt?: string): AsyncGenerator<string> {
    for await (const chunk of this.reasonerStream(userPrompt, systemPrompt)) {
      if (chunk.type === 'answer') {
        yield chunk.content;
      }
    }
  }

  /**
   * Reason with conversation history
   * @param messages - Array of messages
   * @returns Object containing reasoning and answer
   */
  async reasonWithMessages(messages: BaseMessage[]): Promise<ReasonerResponse> {
    this.validateApiKey();

    const model = this.getModel();
    const response = await model.invoke(messages);

    return {
      reasoning: this.extractReasoning(response),
      answer: this.extractAnswer(response),
    };
  }

  /**
   * Check if reasoner is available
   * Returns true if the model supports reasoning
   */
  supportsReasoning(): boolean {
    return this.isReasoner();
  }

  /**
   * Get reasoning mode information
   * Returns information about the reasoning capabilities
   */
  getReasoningInfo(): {
    model: string;
    supportsReasoning: boolean;
    supportsToolCalling: boolean;
    supportsStructuredOutput: boolean;
  } {
    return {
      model: this.modelType,
      supportsReasoning: true,
      supportsToolCalling: false, // As of 2025/1/27
      supportsStructuredOutput: false, // As of 2025/1/27
    };
  }
}
