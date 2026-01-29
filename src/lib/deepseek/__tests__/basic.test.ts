/**
 * Basic integration tests for DeepSeek LangChain module
 *
 * Note: These tests require a valid DEEPSEEK_API_KEY environment variable.
 * Run with: DEEPSEEK_API_KEY=your_key npm test
 */

// Note: Testing framework needs to be installed (vitest or jest)
// These are basic type-level tests that don't require the test runner

import {
  DeepSeekChatClient,
  DeepSeekReasonerClient,
  callDeepSeekChat,
  callDeepSeekReasoner,
  deepSeekChatClient,
  deepSeekReasonerClient,
  createDeepSeekChatClient,
  createDeepSeekReasonerClient,
  createCustomTool,
} from '../index';
import { z } from 'zod';

// Type-level verification (these will be checked by TypeScript)
// Note: Variables are intentionally unused - this is for type checking only
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function verifyTypes() {
  // Verify types at compile time
  void createDeepSeekChatClient;
  void createDeepSeekReasonerClient;
  void callDeepSeekChat;
  void callDeepSeekReasoner;
  void deepSeekChatClient;
  void deepSeekReasonerClient;
  void createCustomTool;
}

describe('DeepSeek Module - Basic Tests', () => {
  describe('Environment Setup', () => {
    it('should have API key configured', () => {
      const apiKey = process.env.DEEPSEEK_API_KEY;
      // Only fail if we're actually trying to run integration tests
      if (process.env.RUN_INTEGRATION_TESTS) {
        expect(apiKey).toBeTruthy();
        expect(apiKey?.startsWith('sk-')).toBe(true);
      }
    });
  });

  describe('Client Creation', () => {
    it('should create chat client', () => {
      const client = createDeepSeekChatClient();
      expect(client).toBeInstanceOf(DeepSeekChatClient);
    });

    it('should create reasoner client', () => {
      const client = createDeepSeekReasonerClient();
      expect(client).toBeInstanceOf(DeepSeekReasonerClient);
    });

    it('should create client with custom config', () => {
      const client = createDeepSeekChatClient({
        temperature: 0.5,
        maxTokens: 1000,
      });
      expect(client).toBeInstanceOf(DeepSeekChatClient);
      expect(client.getTemperature()).toBe(0.5);
      expect(client.getMaxTokens()).toBe(1000);
    });
  });

  describe('Singleton Instances', () => {
    it('should export chat client singleton', () => {
      expect(deepSeekChatClient).toBeInstanceOf(DeepSeekChatClient);
    });

    it('should export reasoner client singleton', () => {
      expect(deepSeekReasonerClient).toBeInstanceOf(DeepSeekReasonerClient);
    });
  });

  describe('Client Configuration', () => {
    it('should allow temperature updates', () => {
      const client = new DeepSeekChatClient();
      client.setTemperature(0.8);
      expect(client.getTemperature()).toBe(0.8);
    });

    it('should reject invalid temperature', () => {
      const client = new DeepSeekChatClient();
      expect(() => client.setTemperature(-1)).toThrow();
      expect(() => client.setTemperature(3)).toThrow();
    });

    it('should allow maxTokens updates', () => {
      const client = new DeepSeekChatClient();
      client.setMaxTokens(2000);
      expect(client.getMaxTokens()).toBe(2000);
    });

    it('should identify model types correctly', () => {
      const chatClient = new DeepSeekChatClient();
      const reasonerClient = new DeepSeekReasonerClient();

      expect(chatClient.isChat()).toBe(true);
      expect(chatClient.isReasoner()).toBe(false);
      expect(reasonerClient.isReasoner()).toBe(true);
      expect(reasonerClient.isChat()).toBe(false);
    });
  });

  describe('Tool Creation', () => {
    it('should create custom tool', () => {
      const testTool = createCustomTool(
        'test_tool',
        'A test tool',
        z.object({
          input: z.string(),
        }),
        async ({ input }) => `Result: ${input}`
      );

      expect(testTool).toHaveProperty('name', 'test_tool');
      expect(testTool).toHaveProperty('description');
    });
  });

  describe('Convenience Functions', () => {
    it('should export callDeepSeekChat function', () => {
      expect(typeof callDeepSeekChat).toBe('function');
    });

    it('should export callDeepSeekReasoner function', () => {
      expect(typeof callDeepSeekReasoner).toBe('function');
    });
  });

  describe('Backward Compatibility', () => {
    it('should export legacy DeepSeekClient', async () => {
      const { DeepSeekClient } = await import('../index');
      expect(DeepSeekClient).toBeDefined();
    });

    it('should export legacy deepSeekClient singleton', async () => {
      const { deepSeekClient: legacyClient } = await import('../index');
      expect(legacyClient).toBeDefined();
    });
  });
});

// Integration tests (only run with DEEPSEEK_API_KEY)
describe.runIf(process.env.RUN_INTEGRATION_TESTS === 'true')('DeepSeek Integration Tests', () => {
  describe('Chat Mode', () => {
    it('should perform basic chat', async () => {
      const response = await callDeepSeekChat('Say "Hello World"');
      expect(response).toBeTruthy();
      expect(typeof response).toBe('string');
    });

    it('should perform chat with system prompt', async () => {
      const client = new DeepSeekChatClient();
      const response = await client.chat('What is your role?', 'You are a helpful assistant.');
      expect(response).toBeTruthy();
    });

    it('should perform streaming chat', async () => {
      const client = new DeepSeekChatClient();
      const chunks: string[] = [];

      for await (const chunk of client.chatStream('Count to 5')) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks.join('')).toBeTruthy();
    });
  });

  describe('Reasoner Mode', () => {
    it('should perform basic reasoning', async () => {
      const { reasoning, answer } = await callDeepSeekReasoner('What is 2+2?');

      expect(reasoning).toBeTruthy();
      expect(answer).toBeTruthy();
      expect(typeof reasoning).toBe('string');
      expect(typeof answer).toBe('string');
    });

    it('should perform streaming reasoning', async () => {
      const client = new DeepSeekReasonerClient();
      const chunks: Array<{ type: string; content: string }> = [];

      for await (const chunk of client.reasonerStream('Solve: x + 3 = 7')) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBeGreaterThan(0);
    });
  });

  describe('Tool Calling (Chat only)', () => {
    it('should bind tools to model', async () => {
      const client = new DeepSeekChatClient();
      const tool = createCustomTool(
        'get_weather',
        'Get weather for a location',
        z.object({
          location: z.string(),
        }),
        async ({ location }) => `Weather in ${location}: Sunny, 20°C`
      );

      const modelWithTools = client.bindTools([tool]);
      expect(modelWithTools).toBeDefined();
    });
  });

  describe('Structured Output (Chat only)', () => {
    it('should create structured output model', async () => {
      const client = new DeepSeekChatClient();
      const DecisionSchema = z.object({
        action: z.enum(['buy', 'sell', 'hold']),
        confidence: z.number().min(0).max(1),
      });

      const structuredModel = client.withStructuredOutput(DecisionSchema);
      expect(structuredModel).toBeDefined();
      expect(typeof structuredModel.invoke).toBe('function');
    });
  });
});
