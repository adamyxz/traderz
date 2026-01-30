import { ChatDeepSeek } from '@langchain/deepseek';
import { BaseMessage, HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages';
import type { StructuredToolInterface } from '@langchain/core/tools';
import type { z } from 'zod';
import { DeepSeekLangChainClient } from './core';
import type { DeepSeekChatConfig, StreamChunk, ChatOptions } from './types';
import { eventBus } from './events';
import type { CallType } from './monitor-types';

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
   * Chat with tools - invokes model with tool calling enabled
   * @param userPrompt - The user's prompt
   * @param systemPrompt - Optional system prompt
   * @param tools - Array of tools to make available to the model
   * @returns Response with content and any tool calls made
   */
  async chatWithTools(
    userPrompt: string,
    systemPrompt: string,
    tools: StructuredToolInterface[]
  ): Promise<{
    content: string;
    toolCalls: Array<{ name: string; arguments: string }>;
    totalTokens?: number;
    eventId?: string;
  }> {
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

    try {
      const model = this.getModel();
      const messages = this.prepareMessages(systemPrompt, userPrompt);

      // Bind tools to the model
      const modelWithTools = model.bindTools(tools);

      // Invoke the model with tools
      const response = await modelWithTools.invoke(messages);
      const duration = Date.now() - startTime;

      // Log response structure for debugging
      console.log('[chatWithTools] Response structure:', {
        contentType: typeof response.content,
        contentIsArray: Array.isArray(response.content),
        responseKeys: Object.keys(response),
        hasToolCalls: !!('tool_calls' in response && response.tool_calls),
        toolCalls: 'tool_calls' in response ? response.tool_calls : undefined,
        content: response.content,
      });

      // Extract content and tool calls
      let content = '';
      const toolCalls: Array<{ name: string; arguments: string }> = [];

      // First, check for tool_calls directly on response
      if ('tool_calls' in response && Array.isArray(response.tool_calls)) {
        console.log('[chatWithTools] Found tool_calls on response');
        for (const tc of response.tool_calls) {
          toolCalls.push({
            name: tc.name || '',
            arguments: JSON.stringify(tc.args || {}),
          });
          console.log('[chatWithTools] Tool call:', tc);
        }
      }

      // Then process content
      if (typeof response.content === 'string') {
        content = response.content;
      } else if (Array.isArray(response.content)) {
        // Handle tool calls in response
        for (const item of response.content) {
          console.log('[chatWithTools] Processing item:', {
            type: item.type,
            item,
          });
          if (item.type === 'text') {
            content += item.text;
          } else if (item.type === 'tool-use') {
            toolCalls.push({
              name: String(item.tool || item.toolName || ''),
              arguments: JSON.stringify(item.args || {}),
            });
          } else if (item.lc_name === 'ToolMessage' || item.constructor?.name === 'ToolMessage') {
            // LangChain ToolMessage format
            toolCalls.push({
              name: String(item.tool_call?.name || item.name || ''),
              arguments: JSON.stringify(item.tool_call?.args || item.args || {}),
            });
          }
        }
      }

      // Calculate approximate token count (rough estimation)
      const totalTokens = Math.ceil(
        (userPrompt.length + (systemPrompt?.length || 0) + content.length) / 4
      );

      eventBus.emitCallCompleted({
        eventId,
        duration,
        timestamp: Date.now(),
        content: content || 'Tool calls executed',
        tokensUsed: totalTokens,
      });

      return {
        content,
        toolCalls,
        totalTokens,
        eventId,
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
  withStructuredOutput<T extends z.ZodTypeAny>(
    schema: T
  ): {
    invoke: (prompt: string, systemPrompt?: string) => Promise<z.infer<T>>;
    invokeWithOptions: (
      prompt: string,
      systemPrompt: string | undefined,
      options: {
        metadata?: Record<string, unknown>;
        callType?: CallType;
      }
    ) => Promise<z.infer<T>>;
  } {
    const model = this.getModel();

    // Create a structured output runner
    const structuredModel = model.withStructuredOutput(schema);

    return {
      invoke: async (prompt: string, systemPrompt?: string): Promise<z.infer<T>> => {
        this.validateApiKey();

        const startTime = Date.now();
        const { eventId } = eventBus.emitCallStarted({
          modelType: this.modelType,
          callType: 'chat',
          systemPrompt,
          userPrompt: prompt,
          temperature: this.temperature,
          maxTokens: this.maxTokens,
        });

        try {
          const messages = systemPrompt
            ? [new SystemMessage(systemPrompt), new HumanMessage(prompt)]
            : [new HumanMessage(prompt)];

          const result = await structuredModel.invoke(messages);
          const duration = Date.now() - startTime;

          // Emit completion event
          eventBus.emitCallCompleted({
            eventId,
            duration,
            timestamp: Date.now(),
            content: JSON.stringify(result, null, 2),
          });

          // The result is already parsed by LangChain
          return result as z.infer<T>;
        } catch (error) {
          eventBus.emitCallError({
            eventId,
            error: error instanceof Error ? error.message : String(error),
            timestamp: Date.now(),
          });
          throw error;
        }
      },

      invokeWithOptions: async (
        prompt: string,
        systemPrompt: string | undefined,
        options: {
          metadata?: Record<string, unknown>;
          callType?: CallType;
        } = {}
      ): Promise<z.infer<T>> => {
        this.validateApiKey();

        const startTime = Date.now();
        const { eventId } = eventBus.emitCallStarted({
          modelType: this.modelType,
          callType: options.callType || 'chat',
          systemPrompt,
          userPrompt: prompt,
          temperature: this.temperature,
          maxTokens: this.maxTokens,
        });

        try {
          const messages = systemPrompt
            ? [new SystemMessage(systemPrompt), new HumanMessage(prompt)]
            : [new HumanMessage(prompt)];

          const result = await structuredModel.invoke(messages);
          const duration = Date.now() - startTime;

          // Emit completion event with metadata
          eventBus.emitCallCompleted({
            eventId,
            duration,
            timestamp: Date.now(),
            content: JSON.stringify(result, null, 2),
            metadata: options.metadata,
          });

          // The result is already parsed by LangChain
          return result as z.infer<T>;
        } catch (error) {
          eventBus.emitCallError({
            eventId,
            error: error instanceof Error ? error.message : String(error),
            timestamp: Date.now(),
          });
          throw error;
        }
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
