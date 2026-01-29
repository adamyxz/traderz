# DeepSeek LangChain Module

A modern, LangChain-based implementation for interacting with DeepSeek API. Supports both chat and reasoner modes with advanced features like tool calling, structured output, and streaming.

## Features

- ✅ **Dual Mode Support**: Chat mode and Reasoner mode
- ✅ **Tool Calling**: Bind tools to the chat model (deepseek-chat only)
- ✅ **Structured Output**: Generate structured data using Zod schemas (deepseek-chat only)
- ✅ **Streaming**: Native streaming support for both modes
- ✅ **TypeScript**: Full type safety
- ✅ **Backward Compatible**: Legacy API still works
- ✅ **LangChain Integration**: Seamless integration with LangChain ecosystem

## Installation

Dependencies are already installed in the project:

```bash
npm install @langchain/deepseek @langchain/core zod
```

## Configuration

Set your API key in `.env`:

```env
DEEPSEEK_API_KEY=your_api_key_here
```

Get your API key from: https://platform.deepseek.com/

## Quick Start

### Basic Chat

```typescript
import { callDeepSeekChat } from '@/lib/deepseek';

const response = await callDeepSeekChat('Explain quantum computing');
console.log(response);
```

### Basic Reasoner

```typescript
import { callDeepSeekReasoner } from '@/lib/deepseek';

const { reasoning, answer } = await callDeepSeekReasoner('What is 2+2?');
console.log('Reasoning:', reasoning);
console.log('Answer:', answer);
```

## Advanced Usage

### Using Client Classes

#### Chat Client

```typescript
import { DeepSeekChatClient } from '@/lib/deepseek';

const client = new DeepSeekChatClient({
  temperature: 0.7,
  maxTokens: 1000,
});

// Basic chat
const response = await client.chat('Hello!');

// Chat with system prompt
const response = await client.chat('What is your role?', 'You are a helpful assistant.');

// Streaming
for await (const chunk of client.chatStream('Tell me a story')) {
  process.stdout.write(chunk);
}
```

#### Reasoner Client

```typescript
import { DeepSeekReasonerClient } from '@/lib/deepseek';

const client = new DeepSeekReasonerClient({
  temperature: 0.7,
});

// Get reasoning and answer
const { reasoning, answer } = await client.reasoner('Solve: x + 3 = 7');

// Get only the answer
const answer = await client.answerOnly('What is the capital of France?');

// Get only the reasoning
const reasoning = await client.reasoningOnly('Why is the sky blue?');

// Streaming
for await (const chunk of client.reasonerStream('Explain photosynthesis')) {
  if (chunk.type === 'reasoning') {
    console.log('Thinking:', chunk.content);
  } else {
    console.log('Answer:', chunk.content);
  }
}
```

### Tool Calling (deepseek-chat only)

```typescript
import { DeepSeekChatClient } from '@/lib/deepseek';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';

const client = new DeepSeekChatClient();

// Define a tool
const weatherTool = tool(
  async ({ location }) => {
    // Call your weather API here
    return `Weather in ${location}: Sunny, 20°C`;
  },
  {
    name: 'get_weather',
    description: 'Get weather for a location',
    schema: z.object({
      location: z.string(),
    }),
  }
);

// Bind tools to the model
const modelWithTools = client.bindTools([weatherTool]);

// Use the model with tools
const response = await modelWithTools.invoke("What's the weather in Tokyo?");
```

### Structured Output (deepseek-chat only)

```typescript
import { DeepSeekChatClient } from '@/lib/deepseek';
import { z } from 'zod';

const client = new DeepSeekChatClient();

// Define output schema
const DecisionSchema = z.object({
  action: z.enum(['buy', 'sell', 'hold']),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
});

// Create structured output model
const structuredModel = client.withStructuredOutput(DecisionSchema);

// Get structured output
const decision = await structuredModel.invoke('Should I buy BTC right now?');

console.log(decision.action); // 'buy'
console.log(decision.confidence); // 0.85
console.log(decision.reasoning); // 'Based on market conditions...'
```

### Using Preset Tools

```typescript
import {
  deepSeekChatClient,
  getTraderInfoTool,
  analyzeRiskTool,
  getMarketDataTool,
} from '@/lib/deepseek';

// Bind preset tools
const modelWithTools = deepSeekChatClient.bindTools([
  getTraderInfoTool,
  analyzeRiskTool,
  getMarketDataTool,
]);

// Use the model
const response = await modelWithTools.invoke(
  'Analyze the risk for a BTC position with size 1.5, entry 45000, and stop loss 44000'
);
```

### Batch Processing

```typescript
import { DeepSeekChatClient } from '@/lib/deepseek';

const client = new DeepSeekChatClient();

// Batch chat requests
const prompts = ['What is 2+2?', 'What is 3+3?', 'What is 4+4?'];
const responses = await client.batchChat(prompts);

console.log(responses); // ['4', '6', '8']
```

### Streaming Convenience Functions

```typescript
import { streamDeepSeekChat, streamDeepSeekReasoner } from '@/lib/deepseek';

// Stream chat
for await (const chunk of streamDeepSeekChat('Tell me a joke')) {
  console.log(chunk);
}

// Stream reasoner
for await (const chunk of streamDeepSeekReasoner('Why is the sky blue?')) {
  if (chunk.type === 'reasoning') {
    console.log('[Reasoning]', chunk.content);
  } else {
    console.log('[Answer]', chunk.content);
  }
}
```

## Configuration Management

### Global Configuration

```typescript
import { deepSeekConfig } from '@/lib/deepseek';

// Update global config
deepSeekConfig.updateConfig({
  temperature: 0.5,
  model: 'deepseek-chat',
});

// Reset to defaults
deepSeekConfig.resetConfig();

// Get current config
const config = deepSeekConfig.getConfig();
```

### Client Configuration

```typescript
import { DeepSeekChatClient } from '@/lib/deepseek';

const client = new DeepSeekChatClient({
  apiKey: 'your_api_key', // Optional, uses env var by default
  model: 'deepseek-chat',
  temperature: 0.7,
  maxTokens: 1000,
});

// Update config later
client.updateConfig({
  temperature: 0.5,
  maxTokens: 2000,
});

// Individual setters
client.setTemperature(0.8);
client.setMaxTokens(1500);
client.setApiKey('new_api_key');
```

## Model Differences

### deepseek-chat

- ✅ Standard conversations
- ✅ Tool calling
- ✅ Structured output
- ✅ Streaming
- Faster responses
- Lower cost

### deepseek-reasoner

- ✅ Complex reasoning
- ✅ Shows reasoning process
- ✅ Streaming (reasoning + answer)
- ❌ No tool calling (as of 2025/1/27)
- ❌ No structured output (as of 2025/1/27)
- Higher cost
- Better for complex problems

## Backward Compatibility

The old API is still available but deprecated:

```typescript
// Old way (still works, but deprecated)
import { callDeepSeek, DeepSeekClient } from '@/lib/deepseek';

const client = new DeepSeekClient();
const result = await client.chat({
  userPrompt: 'Hello',
  model: 'deepseek-chat',
});
```

**Migration Guide:**

```typescript
// Old
import { callDeepSeekChat, callDeepSeekReasoner } from '@/lib/deepseek';
const result = await callDeepSeekChat({ userPrompt: 'Hello' });

// New (simpler)
import { callDeepSeekChat } from '@/lib/deepseek';
const result = await callDeepSeekChat('Hello');
```

## API Reference

### Classes

- `DeepSeekLangChainClient` - Base class
- `DeepSeekChatClient` - Chat mode with tool calling & structured output
- `DeepSeekReasonerClient` - Reasoner mode with reasoning process

### Convenience Functions

- `callDeepSeekChat(prompt, systemPrompt?)` - Quick chat
- `callDeepSeekReasoner(prompt, systemPrompt?)` - Quick reasoning
- `streamDeepSeekChat(prompt, systemPrompt?)` - Stream chat
- `streamDeepSeekReasoner(prompt, systemPrompt?)` - Stream reasoning
- `createDeepSeekChatClient(config?)` - Create chat client
- `createDeepSeekReasonerClient(config?)` - Create reasoner client

### Singletons

- `deepSeekChatClient` - Default chat client
- `deepSeekReasonerClient` - Default reasoner client

### Tools

- `getTraderInfoTool` - Get trader information
- `analyzeRiskTool` - Analyze trading risk
- `getMarketDataTool` - Get market data

### Schemas

- `TradingDecisionSchema` - Trading decision structure
- `MarketAnalysisSchema` - Market analysis structure
- `TraderConfigSchema` - Trader configuration structure
- `RiskAssessmentSchema` - Risk assessment structure

## Error Handling

```typescript
import { DeepSeekChatClient } from '@/lib/deepseek';

const client = new DeepSeekChatClient();

try {
  const response = await client.chat('Hello');
} catch (error) {
  if (error instanceof Error) {
    if (error.message.includes('API key')) {
      console.error('Invalid API key');
    } else if (error.message.includes('rate limit')) {
      console.error('Rate limit exceeded');
    } else {
      console.error('Error:', error.message);
    }
  }
}
```

## Best Practices

1. **Use appropriate model**:
   - Use `deepseek-chat` for simple tasks and tool calling
   - Use `deepseek-reasoner` for complex reasoning

2. **Set appropriate temperature**:
   - 0.0-0.3: Deterministic, factual responses
   - 0.4-0.7: Balanced (default)
   - 0.8-1.0: Creative, varied responses

3. **Use streaming for long responses**:
   - Better user experience
   - Lower perceived latency

4. **Leverage structured output**:
   - Type-safe responses
   - Easier to parse and use

5. **Batch when possible**:
   - Better performance
   - Lower cost

## Troubleshooting

### "DEEPSEEK_API_KEY is not set"

Make sure your `.env` file contains:

```env
DEEPSEEK_API_KEY=sk-...
```

### "Model does not support tool calling"

Tool calling is only available with `deepseek-chat`, not `deepseek-reasoner`.

### Type errors with structured output

Make sure to use `z.object()` and provide proper Zod schemas.

## License

MIT

## Links

- [DeepSeek Platform](https://platform.deepseek.com/)
- [LangChain Documentation](https://js.langchain.com/)
- [Zod Documentation](https://zod.dev/)
