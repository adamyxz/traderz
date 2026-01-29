import { ChatDeepSeek } from '@langchain/deepseek';
import type { BaseDeepSeekConfig, DeepSeekModelType } from './types';
import { getApiKey, validateApiKey } from './config';
import { eventBus } from './events';

/**
 * Base DeepSeek client using LangChain
 * Provides core functionality for all DeepSeek interactions
 */
export class DeepSeekLangChainClient {
  protected modelType: DeepSeekModelType;
  protected apiKey: string;
  protected temperature: number;
  protected maxTokens?: number;
  protected baseURL: string;
  protected langChainModel: ChatDeepSeek | null = null;

  constructor(config: BaseDeepSeekConfig = {}) {
    const {
      apiKey: providedApiKey,
      model = 'deepseek-chat',
      temperature = 0.7,
      maxTokens,
      baseURL = 'https://api.deepseek.com',
    } = config;

    this.modelType = model;
    this.apiKey = providedApiKey || '';
    this.temperature = temperature;
    this.maxTokens = maxTokens;
    this.baseURL = baseURL;
  }

  /**
   * Get or initialize the LangChain model
   */
  protected getModel(eventId?: string): ChatDeepSeek {
    if (!this.langChainModel) {
      const apiKey = this.apiKey || getApiKey();
      validateApiKey(apiKey);

      this.langChainModel = new ChatDeepSeek({
        apiKey,
        model: this.modelType,
        temperature: this.temperature,
        ...(this.maxTokens && { maxTokens: this.maxTokens }),
      });
    }

    // Emit model creation event if eventId is provided
    if (eventId) {
      eventBus.emitCallStarted({
        modelType: this.modelType,
        callType: this.modelType === 'deepseek-reasoner' ? 'reasoner' : 'chat',
        temperature: this.temperature,
        maxTokens: this.maxTokens,
        userPrompt: '', // Will be filled by specific implementations
        systemPrompt: undefined,
      });
    }

    return this.langChainModel;
  }

  /**
   * Get the underlying LangChain model instance
   * Useful for advanced LangChain operations
   */
  getLangChainModel(): ChatDeepSeek {
    return this.getModel();
  }

  /**
   * Update configuration
   * Note: This will recreate the LangChain model on next use
   */
  updateConfig(config: Partial<BaseDeepSeekConfig>): void {
    if (config.apiKey !== undefined) {
      this.apiKey = config.apiKey;
    }
    if (config.model !== undefined) {
      this.modelType = config.model;
    }
    if (config.temperature !== undefined) {
      this.temperature = config.temperature;
    }
    if (config.maxTokens !== undefined) {
      this.maxTokens = config.maxTokens;
    }
    if (config.baseURL !== undefined) {
      this.baseURL = config.baseURL;
    }

    // Reset the model to force reinitialization with new config
    this.langChainModel = null;
  }

  /**
   * Get current configuration
   */
  getConfig(): BaseDeepSeekConfig {
    return {
      apiKey: this.apiKey,
      model: this.modelType,
      temperature: this.temperature,
      maxTokens: this.maxTokens,
      baseURL: this.baseURL,
    };
  }

  /**
   * Set API key
   */
  setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
    this.langChainModel = null; // Force reinitialization
  }

  /**
   * Get model type
   */
  getModelType(): DeepSeekModelType {
    return this.modelType;
  }

  /**
   * Check if this is a reasoner model
   */
  isReasoner(): boolean {
    return this.modelType === 'deepseek-reasoner';
  }

  /**
   * Check if this is a chat model
   */
  isChat(): boolean {
    return this.modelType === 'deepseek-chat';
  }

  /**
   * Get temperature
   */
  getTemperature(): number {
    return this.temperature;
  }

  /**
   * Set temperature
   */
  setTemperature(temperature: number): void {
    if (temperature < 0 || temperature > 2) {
      throw new Error('Temperature must be between 0 and 2');
    }
    this.temperature = temperature;
    this.langChainModel = null; // Force reinitialization
  }

  /**
   * Get max tokens
   */
  getMaxTokens(): number | undefined {
    return this.maxTokens;
  }

  /**
   * Set max tokens
   */
  setMaxTokens(maxTokens: number): void {
    this.maxTokens = maxTokens;
    this.langChainModel = null; // Force reinitialization
  }

  /**
   * Validate API key presence
   * Throws error if API key is not configured
   */
  protected validateApiKey(): void {
    const apiKey = this.apiKey || getApiKey();
    validateApiKey(apiKey);
  }

  /**
   * Prepare messages from system prompt and user prompt
   */
  protected prepareMessages(
    systemPrompt: string | undefined,
    userPrompt: string
  ): Array<{ role: string; content: string }> {
    const messages: Array<{ role: string; content: string }> = [];

    if (systemPrompt) {
      messages.push({
        role: 'system',
        content: systemPrompt,
      });
    }

    messages.push({
      role: 'user',
      content: userPrompt,
    });

    return messages;
  }
}
