import { ChatDeepSeek } from '@langchain/deepseek';
import { BaseMessage, HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages';
import type { StructuredToolInterface } from '@langchain/core/tools';
import type { z } from 'zod';
import { DeepSeekLangChainClient } from './core';
import type { DeepSeekChatConfig, StreamChunk, ChatOptions } from './types';
import { eventBus } from './events';

/**
 * Chat mode client for DeepSeek
 * Supports tool calling, structured output, and streaming
 */
export class DeepSeekChatClient extends DeepSeekLangChainClient {
  constructor(config: DeepSeekChatConfig = {}) {
    super({
      ...config,
      model: config.model || 'deepseek-chat',
    });
  }

  /**
   * Basic chat invocation
   * @param userPrompt - The user's prompt
   * @param systemPrompt - Optional system prompt
   * @returns The model's response as a string
   */
  async chat(userPrompt: string, systemPrompt?: string): Promise<string> {
    this.validateApiKey();

    const startTime = Date.now();
    const { eventId } = eventBus.emitCallStarted({
      modelType: this.modelType,
      callType: 'chat',
      systemPrompt,
      userPrompt,
      temperature: this.temperature,
      maxTokens: this.maxTokens,
    });

    const model = this.getModel();
    const messages = this.prepareMessages(systemPrompt, userPrompt);

    try {
      const response = await model.invoke(messages);
      const content = response.content as string;
      const duration = Date.now() - startTime;

      eventBus.emitCallCompleted({
        eventId,
        duration,
        timestamp: Date.now(),
        content,
      });

      return content;
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
   * Chat with options object (backward compatible)
   */
  async chatWithOptions(options: ChatOptions): Promise<string> {
    const { systemPrompt, userPrompt, temperature, maxTokens } = options;

    // Apply temperature and maxTokens if provided
    if (temperature !== undefined) {
      this.setTemperature(temperature);
    }
    if (maxTokens !== undefined) {
      this.setMaxTokens(maxTokens);
    }

    const startTime = Date.now();
    const { eventId } = eventBus.emitCallStarted({
      modelType: this.modelType,
      callType: 'chat',
      systemPrompt,
      userPrompt,
      temperature: this.temperature,
      maxTokens: this.maxTokens,
    });

    try {
      const model = this.getModel();
      const messages = this.prepareMessages(systemPrompt, userPrompt);
      const response = await model.invoke(messages);
      let result = response.content as string;
      const duration = Date.now() - startTime;

      // Apply output template if provided
      if (options.outputTemplate) {
        result = this.applyOutputTemplate(result, options.outputTemplate);
      }

      eventBus.emitCallCompleted({
        eventId,
        duration,
        timestamp: Date.now(),
        content: result,
      });

      return result;
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
   * Stream chat responses
   * @param userPrompt - The user's prompt
   * @param systemPrompt - Optional system prompt
   * @returns Async generator yielding response chunks
   */
  async *chatStream(userPrompt: string, systemPrompt?: string): AsyncGenerator<StreamChunk> {
    this.validateApiKey();

    const startTime = Date.now();
    const { eventId } = eventBus.emitCallStarted({
      modelType: this.modelType,
      callType: 'chat-stream',
      systemPrompt,
      userPrompt,
      temperature: this.temperature,
      maxTokens: this.maxTokens,
    });

    const model = this.getModel();
    const messages = this.prepareMessages(systemPrompt, userPrompt);
    let fullResponse = '';

    try {
      const stream = await model.stream(messages);

      console.log('[Chat] Starting stream for eventId:', eventId);

      for await (const chunk of stream) {
        const content = chunk.content as string | undefined;
        if (content) {
          fullResponse += content;
          console.log('[Chat] Emitting chunk:', {
            eventId,
            chunkLength: content.length,
            totalLength: fullResponse.length,
            preview: content.substring(0, 30),
          });
          eventBus.emitCallChunk(eventId, {
            eventId,
            content,
            timestamp: Date.now(),
          });
          yield content;
        }
      }

      const duration = Date.now() - startTime;

      console.log('[Chat] Stream completed:', {
        eventId,
        duration,
        totalLength: fullResponse.length,
      });

      eventBus.emitCallCompleted({
        eventId,
        duration,
        timestamp: Date.now(),
        content: fullResponse,
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
   * Bind tools to the model for tool calling
   * @param tools - Array of tools to bind
   * @returns A new model instance with tools bound
   */
  bindTools(tools: StructuredToolInterface[]): ReturnType<ChatDeepSeek['bindTools']> {
    const model = this.getModel();
    return model.bindTools(tools);
  }

  /**
   * Bind a single tool
   * @param tool - Tool to bind
   * @returns A new model instance with tool bound
   */
  bindTool(tool: StructuredToolInterface): ReturnType<ChatDeepSeek['bindTools']> {
    return this.bindTools([tool]);
  }

  /**
   * Create a model with structured output
   * @param schema - Zod schema defining the output structure
   * @returns A function that invokes the model and returns structured output
   */
  withStructuredOutput<T extends z.ZodTypeUnknown>(
    schema: T
  ): {
    invoke: (prompt: string, systemPrompt?: string) => Promise<z.infer<T>>;
  } {
    const model = this.getModel();

    // Create a structured output runner
    const structuredModel = model.withStructuredOutput(schema);

    return {
      invoke: async (prompt: string, systemPrompt?: string): Promise<z.infer<T>> => {
        this.validateApiKey();

        const messages = systemPrompt
          ? [new SystemMessage(systemPrompt), new HumanMessage(prompt)]
          : [new HumanMessage(prompt)];

        const result = await structuredModel.invoke(messages);

        // The result is already parsed by LangChain
        return result as z.infer<T>;
      },
    };
  }

  /**
   * Invoke with multiple messages (for conversation history)
   * @param messages - Array of messages
   * @returns The model's response
   */
  async chatWithMessages(messages: BaseMessage[]): Promise<string> {
    this.validateApiKey();

    const model = this.getModel();
    const response = await model.invoke(messages);

    return response.content as string;
  }

  /**
   * Stream with multiple messages
   * @param messages - Array of messages
   * @returns Async generator yielding response chunks
   */
  async *chatStreamWithMessages(messages: BaseMessage[]): AsyncGenerator<StreamChunk> {
    this.validateApiKey();

    const model = this.getModel();
    const stream = await model.stream(messages);

    for await (const chunk of stream) {
      const content = chunk.content as string | undefined;
      if (content) {
        yield content;
      }
    }
  }

  /**
   * Apply output template (backward compatibility)
   */
  private applyOutputTemplate(content: string, template: string): string {
    return template.replace(/\{\{content\}\}/g, content);
  }

  /**
   * Create LangChain messages from objects
   */
  createMessages(messageArray: Array<{ role: string; content: string }>): BaseMessage[] {
    return messageArray.map((msg) => {
      switch (msg.role) {
        case 'system':
          return new SystemMessage(msg.content);
        case 'user':
          return new HumanMessage(msg.content);
        case 'assistant':
          return new AIMessage(msg.content);
        default:
          throw new Error(`Unknown message role: ${msg.role}`);
      }
    });
  }

  /**
   * Batch processing - chat with multiple prompts
   * @param prompts - Array of prompts
   * @param systemPrompt - Optional system prompt for all prompts
   * @returns Array of responses
   */
  async batchChat(prompts: string[], systemPrompt?: string): Promise<string[]> {
    this.validateApiKey();

    const model = this.getModel();
    const messageBatches = prompts.map((prompt) => this.prepareMessages(systemPrompt, prompt));

    const results = await model.batch(messageBatches);

    return results.map((result) => result.content as string);
  }
}
