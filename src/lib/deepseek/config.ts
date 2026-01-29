import type { BaseDeepSeekConfig, DeepSeekModelType } from './types';

/**
 * Global configuration manager for DeepSeek module
 * Allows runtime configuration updates
 */
class DeepSeekConfigManager {
  private config: BaseDeepSeekConfig = {
    apiKey: '',
    model: 'deepseek-chat',
    temperature: 0.7,
    baseURL: 'https://api.deepseek.com',
  };

  /**
   * Get current configuration
   */
  getConfig(): BaseDeepSeekConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   * @param updates - Configuration updates to apply
   */
  updateConfig(updates: Partial<BaseDeepSeekConfig>): void {
    this.config = {
      ...this.config,
      ...updates,
    };
  }

  /**
   * Reset to default configuration
   */
  resetConfig(): void {
    this.config = {
      apiKey: '',
      model: 'deepseek-chat',
      temperature: 0.7,
      baseURL: 'https://api.deepseek.com',
    };
  }

  /**
   * Get API key with fallback to environment variable
   */
  getApiKey(): string {
    if (this.config.apiKey) {
      return this.config.apiKey;
    }
    return process.env.DEEPSEEK_API_KEY || '';
  }

  /**
   * Set API key
   */
  setApiKey(apiKey: string): void {
    this.config.apiKey = apiKey;
  }

  /**
   * Get default model
   */
  getDefaultModel(): DeepSeekModelType {
    return this.config.model || 'deepseek-chat';
  }

  /**
   * Set default model
   */
  setDefaultModel(model: DeepSeekModelType): void {
    this.config.model = model;
  }

  /**
   * Get default temperature
   */
  getDefaultTemperature(): number {
    return this.config.temperature ?? 0.7;
  }

  /**
   * Set default temperature
   */
  setDefaultTemperature(temperature: number): void {
    if (temperature < 0 || temperature > 2) {
      throw new Error('Temperature must be between 0 and 2');
    }
    this.config.temperature = temperature;
  }
}

// Export singleton instance
export const deepSeekConfig = new DeepSeekConfigManager();

/**
 * Helper function to get API key from config or environment
 */
export function getApiKey(providedKey?: string): string {
  if (providedKey) {
    return providedKey;
  }
  return deepSeekConfig.getApiKey();
}

/**
 * Helper function to validate API key presence
 */
export function validateApiKey(apiKey: string): void {
  if (!apiKey) {
    throw new Error(
      'DEEPSEEK_API_KEY is not set. Please provide it via constructor, config, or environment variable.'
    );
  }
}

/**
 * Helper function to get model-specific defaults
 */
export function getModelDefaults(model: DeepSeekModelType): Partial<BaseDeepSeekConfig> {
  const defaults: Record<DeepSeekModelType, Partial<BaseDeepSeekConfig>> = {
    'deepseek-chat': {
      temperature: 0.7,
    },
    'deepseek-reasoner': {
      temperature: 0.7,
    },
  };

  return defaults[model] || {};
}
