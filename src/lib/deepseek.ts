interface DeepSeekMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

type DeepSeekModel = 'deepseek-chat' | 'deepseek-reasoner';

interface DeepSeekRequestOptions {
  model?: DeepSeekModel;
  systemPrompt?: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  outputTemplate?: string;
}

interface DeepSeekResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    prompt_cache_hit_tokens: number;
    prompt_cache_miss_tokens: number;
  };
}

interface DeepSeekReasonerResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
      reasoning_content?: string; // 推理模型的思维链内容
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    prompt_cache_hit_tokens: number;
    prompt_cache_miss_tokens: number;
  };
}

interface DeepSeekError {
  error: {
    message: string;
    type: string;
    code?: string;
  };
}

interface RequestBody {
  model: DeepSeekModel;
  messages: DeepSeekMessage[];
  temperature: number;
  stream: boolean;
  max_tokens?: number;
}

/**
 * DeepSeek API 客户端
 * 支持两种模式：
 * - deepseek-chat: 标准对话模式
 * - deepseek-reasoner: 推理模式（包含思维链）
 */
export class DeepSeekClient {
  private apiKey: string;
  private baseURL = 'https://api.deepseek.com';
  private chatEndpoint = '/v1/chat/completions';

  constructor(apiKey?: string) {
    this.apiKey = apiKey || '';

    if (!this.apiKey && !process.env.DEEPSEEK_API_KEY) {
      console.warn('Warning: DEEPSEEK_API_KEY is not set. Please set it before calling chat().');
    } else if (!this.apiKey) {
      this.apiKey = process.env.DEEPSEEK_API_KEY || '';
    }
  }

  /**
   * 调用DeepSeek API
   * @param options - 请求配置
   * @returns 模型返回的文本内容
   */
  async chat(options: DeepSeekRequestOptions): Promise<string> {
    // 确保API Key存在
    if (!this.apiKey) {
      this.apiKey = process.env.DEEPSEEK_API_KEY || '';
      if (!this.apiKey) {
        throw new Error('DEEPSEEK_API_KEY is not set');
      }
    }

    const {
      model = 'deepseek-chat',
      systemPrompt,
      userPrompt,
      temperature = 0.7,
      maxTokens,
      stream = false,
      outputTemplate,
    } = options;

    // 构建消息数组
    const messages: DeepSeekMessage[] = [];

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

    try {
      const requestBody: RequestBody = {
        model,
        messages,
        temperature,
        stream,
      };

      // max_tokens 是可选参数
      if (maxTokens !== undefined) {
        requestBody.max_tokens = maxTokens;
      }

      const response = await fetch(`${this.baseURL}${this.chatEndpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData: DeepSeekError = await response.json();
        throw new Error(
          `DeepSeek API Error: ${errorData.error.message} (type: ${errorData.error.type})`
        );
      }

      const data: DeepSeekResponse | DeepSeekReasonerResponse = await response.json();
      let content = data.choices[0]?.message?.content || '';

      // 应用输出模版
      if (outputTemplate) {
        content = this.applyOutputTemplate(content, outputTemplate);
      }

      return content;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`DeepSeek request failed: ${error.message}`);
      }
      throw new Error('DeepSeek request failed: Unknown error');
    }
  }

  /**
   * 调用DeepSeek对话模式
   * 适用于一般的对话和问答场景
   */
  async chatMode(options: Omit<DeepSeekRequestOptions, 'model'>): Promise<string> {
    return this.chat({
      ...options,
      model: 'deepseek-chat',
    });
  }

  /**
   * 调用DeepSeek推理模式
   * 包含思维链，适用于复杂推理和问题解决场景
   * 返回包含推理过程的完整内容
   */
  async reasonerMode(options: Omit<DeepSeekRequestOptions, 'model'>): Promise<{
    reasoning: string; // 思维链内容
    answer: string; // 最终答案
  }> {
    // 确保API Key存在
    if (!this.apiKey) {
      this.apiKey = process.env.DEEPSEEK_API_KEY || '';
      if (!this.apiKey) {
        throw new Error('DEEPSEEK_API_KEY is not set');
      }
    }

    const { systemPrompt, userPrompt, temperature = 0.7, maxTokens, stream = false } = options;

    // 构建消息数组
    const messages: DeepSeekMessage[] = [];

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

    try {
      const requestBody: RequestBody = {
        model: 'deepseek-reasoner',
        messages,
        temperature,
        stream,
      };

      if (maxTokens !== undefined) {
        requestBody.max_tokens = maxTokens;
      }

      const response = await fetch(`${this.baseURL}${this.chatEndpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData: DeepSeekError = await response.json();
        throw new Error(
          `DeepSeek API Error: ${errorData.error.message} (type: ${errorData.error.type})`
        );
      }

      const data: DeepSeekReasonerResponse = await response.json();
      const choice = data.choices[0];

      return {
        reasoning: choice.message.reasoning_content || '',
        answer: choice.message.content || '',
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`DeepSeek reasoner request failed: ${error.message}`);
      }
      throw new Error('DeepSeek reasoner request failed: Unknown error');
    }
  }

  /**
   * 应用输出模版
   * @param content - 模型返回的内容
   * @param template - 输出模版，使用 {{content}} 作为占位符
   * @returns 应用模版后的内容
   */
  private applyOutputTemplate(content: string, template: string): string {
    return template.replace(/\{\{content\}\}/g, content);
  }

  /**
   * 设置API Key
   * @param apiKey - 新的API Key
   */
  setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
  }
}

// 导出单例实例
export const deepSeekClient = new DeepSeekClient();

// 导出便捷函数
export async function callDeepSeek(options: DeepSeekRequestOptions): Promise<string> {
  return deepSeekClient.chat(options);
}

export async function callDeepSeekChat(
  options: Omit<DeepSeekRequestOptions, 'model'>
): Promise<string> {
  return deepSeekClient.chatMode(options);
}

export async function callDeepSeekReasoner(
  options: Omit<DeepSeekRequestOptions, 'model'>
): Promise<{ reasoning: string; answer: string }> {
  return deepSeekClient.reasonerMode(options);
}
