# Reader 开发指南

本文档说明如何创建和管理 Traderz 系统中的 Reader。

## 📁 目录结构

```
readers/
├── your-reader-name/
│   ├── index.ts           # Reader 实现文件（必需）
│   └── metadata.json      # Reader 元数据（必需）
```

每个 Reader 必须有自己的独立目录，包含 `index.ts` 和 `metadata.json` 两个文件。

## 📄 元数据格式 (metadata.json)

`metadata.json` 文件定义了 Reader 的基本信息和参数：

```json
{
  "name": "your-reader-name",
  "description": "Reader 功能描述",
  "parameters": [
    {
      "name": "param1",
      "type": "string",
      "displayName": "参数1显示名称",
      "description": "参数的详细描述",
      "required": true,
      "validation": {
        "pattern": "^[A-Z]{2,6}USDT$"
      }
    },
    {
      "name": "param2",
      "type": "number",
      "displayName": "参数2",
      "required": false,
      "defaultValue": 100,
      "validation": {
        "min": 1,
        "max": 1000
      }
    }
  ]
}
```

### 字段说明

**基本信息:**

- `name` (string, 必需): Reader 的唯一标识符，使用 kebab-case
- `description` (string, 必需): Reader 功能描述

**参数定义 (parameters):**

- `name` (string): 参数名称，使用 camelCase
- `type` (string, 必需): 参数类型，可选值：
  - `string`: 字符串
  - `number`: 数字
  - `boolean`: 布尔值
  - `object`: JSON 对象
  - `array`: 数组
  - `enum`: 枚举值
- `displayName` (string, 必需): 参数的显示名称
- `description` (string): 参数描述
- `required` (boolean): 是否必填，默认 `false`
- `defaultValue` (any): 默认值
- `validation` (object): 验证规则
  - `min`: 数字最小值
  - `max`: 数字最大值
  - `pattern`: 正则表达式（用于 string 类型）
  - `enum`: 枚举值数组（用于 enum 类型）

## 💻 实现文件格式 (index.ts)

`index.ts` 文件必须导出一个符合 `ReaderModule` 接口的模块：

```typescript
import { ReaderModule, ReaderInput, ReaderOutput, ReaderContext } from '@/lib/readers/types';
import { z } from 'zod';

// 1. 定义输入验证 schema（可选但推荐）
const InputSchema = z.object({
  symbol: z.string().regex(/^[A-Z]{2,6}USDT$/),
  timeframe: z.enum(['1m', '5m', '15m', '1h', '4h', '1d']),
  limit: z.number().min(1).max(1000).default(100),
});

// 2. 实现执行函数（必需）
async function execute(input: any, context: ReaderContext): Promise<ReaderOutput> {
  const startTime = Date.now();

  try {
    // 验证输入
    const validatedInput = InputSchema.parse(input);

    // 实现业务逻辑
    const result = {
      // 你的返回数据
    };

    return {
      success: true,
      data: result,
      metadata: {
        executionTime: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        version: '1.0.0',
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// 3. 参数验证函数（可选）
function validate(input: ReaderInput) {
  try {
    InputSchema.parse(input);
    return { valid: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        valid: false,
        errors: error.errors.map((e) => `${e.path.join('.')}: ${e.message}`),
      };
    }
    return { valid: false, errors: ['Validation failed'] };
  }
}

// 4. 导出模块（必需）
const readerModule: ReaderModule = {
  execute,
  validate, // 可选
};

export default readerModule;
```

## 🔧 执行上下文 (ReaderContext)

执行函数接收一个 `context` 对象，包含以下信息：

```typescript
interface ReaderContext {
  readerId: string; // Reader 名称
  requestId: string; // 请求 ID (UUID)
  triggeredBy: string; // 触发来源 ('api', 'manual', 'scheduler')
  timestamp: string; // 执行时间戳
  environment: 'development' | 'production'; // 运行环境
}
```

## 📤 返回值格式 (ReaderOutput)

执行函数必须返回符合以下格式的对象：

```typescript
interface ReaderOutput<T = unknown> {
  success: boolean; // 执行是否成功
  data?: T; // 返回数据（成功时）
  error?: string; // 错误信息（失败时）
  metadata?: {
    // 元数据（可选）
    executionTime: number; // 执行耗时（毫秒）
    timestamp: string; // 时间戳
    version: string; // 版本号
  };
}
```

## ⚠️ 重要限制

### 安全限制

- Reader 在独立的子进程中执行
- 默认超时时间 30 秒（可在数据库中配置）
- 无法访问文件系统（除了读取配置）
- 无法进行网络请求（除非明确允许）

### 最佳实践

1. **输入验证**: 始终验证输入参数，使用 Zod schema
2. **错误处理**: 捕获所有异常并返回友好的错误消息
3. **性能**: 避免长时间运行的操作，考虑异步处理
4. **日志**: 使用 `console.log` 输出调试信息（会添加 `[Reader]` 前缀）
5. **纯函数**: 尽量保持执行函数为纯函数，避免副作用

## 📋 完整示例

### metadata.json

```json
{
  "name": "market-data-fetcher",
  "description": "从交易所获取实时市场数据",
  "parameters": [
    {
      "name": "symbol",
      "type": "string",
      "displayName": "交易对",
      "description": "加密货币交易对符号，如 BTCUSDT",
      "required": true,
      "validation": {
        "pattern": "^[A-Z]{2,6}USDT$"
      }
    },
    {
      "name": "interval",
      "type": "enum",
      "displayName": "K线周期",
      "description": "K线数据的时间周期",
      "required": true,
      "validation": {
        "enum": ["1m", "5m", "15m", "1h", "4h", "1d"]
      }
    },
    {
      "name": "limit",
      "type": "number",
      "displayName": "数据条数",
      "description": "获取的K线数据条数",
      "required": false,
      "defaultValue": 100,
      "validation": {
        "min": 1,
        "max": 1000
      }
    }
  ]
}
```

### index.ts

```typescript
import { ReaderModule, ReaderInput, ReaderOutput, ReaderContext } from '@/lib/readers/types';
import { z } from 'zod';

// 输入验证
const InputSchema = z.object({
  symbol: z.string().regex(/^[A-Z]{2,6}USDT$/, {
    message: '交易对格式错误，应为 BTCUSDT 格式',
  }),
  interval: z.enum(['1m', '5m', '15m', '1h', '4h', '1d'], {
    errorMap: () => ({ message: '周期必须是 1m, 5m, 15m, 1h, 4h, 1d 之一' }),
  }),
  limit: z.number().min(1).max(1000).default(100),
});

// 执行函数
async function execute(input: any, context: ReaderContext): Promise<ReaderOutput> {
  const startTime = Date.now();

  try {
    // 验证输入
    const { symbol, interval, limit } = InputSchema.parse(input);

    console.log(`[Reader] Fetching ${symbol} ${interval} data, limit: ${limit}`);

    // 模拟获取数据
    const mockData = {
      symbol,
      interval,
      ticks: Array.from({ length: limit }, (_, i) => ({
        time: Date.now() - (limit - i) * 60000,
        open: 50000 + Math.random() * 1000,
        high: 51000 + Math.random() * 1000,
        low: 49000 + Math.random() * 1000,
        close: 50000 + Math.random() * 1000,
        volume: Math.random() * 1000,
      })),
    };

    return {
      success: true,
      data: mockData,
      metadata: {
        executionTime: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        version: '1.0.0',
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// 参数验证
function validate(input: ReaderInput) {
  try {
    InputSchema.parse(input);
    return { valid: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        valid: false,
        errors: error.errors.map((e) => `${e.path.join('.')}: ${e.message}`),
      };
    }
    return { valid: false, errors: ['Validation failed'] };
  }
}

// 导出模块
const readerModule: ReaderModule = {
  execute,
  validate,
};

export default readerModule;
```

## 🚀 部署流程

1. **创建目录**: 在 `readers/` 下创建新目录
2. **编写代码**: 创建 `index.ts` 和 `metadata.json`
3. **同步到数据库**: 在管理界面点击 "Sync from Files" 按钮
4. **测试**: 使用 "Test" 按钮测试 Reader 是否正常工作

## 📚 相关类型定义

所有类型定义都在 `src/lib/readers/types.ts` 文件中：

```typescript
// Reader 输入
interface ReaderInput {
  [key: string]: unknown;
}

// Reader 输出
interface ReaderOutput<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: {
    executionTime: number;
    timestamp: string;
    version: string;
  };
}

// Reader 模块
interface ReaderModule {
  execute: (input: ReaderInput, context: ReaderContext) => Promise<ReaderOutput>;
  validate?: (input: ReaderInput) => { valid: boolean; errors?: string[] };
}
```

## 💡 提示

- 使用 TypeScript 的类型检查来避免错误
- 在开发时使用 `console.log` 调试，生产环境会自动记录
- 保持 Reader 简单和专注，每个 Reader 只做一件事
- 复杂的业务逻辑应该放在服务层，Reader 只是调用入口
