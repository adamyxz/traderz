# Reader 开发指南

本文档说明如何创建和管理 Traderz 系统中的 Reader。

## 核心原则

开发 Reader 时必须遵循以下原则：

1. **数据质量优先** - 确保数据完整性和准确性
2. **Token 压缩** - 在保证质量的前提下最大化压缩 LLM token 消耗
3. **标准输出** - 统一使用 CSV 格式输出数据
4. **健壮性** - 完善的输入验证和错误处理

## 目录结构

```
readers/
├── your-reader-name/
│   ├── index.ts           # Reader 实现文件（必需）
│   └── metadata.json      # Reader 元数据（必需）
```

每个 Reader 必须有自己的独立目录，包含 `index.ts` 和 `metadata.json` 两个文件。

## 标准输出格式

所有 Reader 必须返回以下标准结构：

```typescript
{
  success: true,
  data: {
    s: string,          // symbol (交易对)
    fmt: 'csv',         // 格式标识，固定为 'csv'
    bT: number,         // base timestamp (基准时间戳，用于相对时间)
    d: string,          // CSV 数据字符串
    cnt: number,        // 数据条数
    fa: string,         // fetched at (ISO 8601 格式时间戳)
    // ... 其他业务特定字段
  },
  metadata: {
    executionTime: number,
    timestamp: string,
    version: string,
  },
}
```

### CSV 数据格式

CSV 数据必须包含表头，每行一条记录，字段用逗号分隔：

```csv
dT,p,q,m
0,50000.5,0.5,1
5000,50001.0,0.3,0
12000,50000.8,0.7,1
```

**关键约定**：

- 第一行是表头，定义字段顺序
- 时间字段使用相对时间戳（如 `dT` = delta Time）
- 布尔值用 `1`/`0` 表示
- 价格保留合理精度（见优化方案）

## Token 压缩策略

系统提供 5 个优化方案，可在保证数据质量的前提下压缩 40-60% 的 token：

### 1. 精度优化

移除价格字符串末尾多余的零：

- `50000.50000` → `50000.5`
- `0.00100000` → `0.001`

```typescript
import { trimPrice } from '@/lib/toon';

const optimized = trimPrice('50000.50000'); // "50000.5"
```

### 2. 相对时间戳

使用相对于第一条记录的时间差，而非绝对时间戳：

```csv
# 原始格式 (13位时间戳)
T
1735689600000
1735689605000
1735689610000

# 优化后 (毫秒差值)
dT
0
5000
10000
```

配合 `bT` (base timestamp) 使用，可完全恢复原始时间。

```typescript
import { toRelativeTimestamps } from '@/lib/toon';

const { baseTime, data } = toRelativeTimestamps(records, 'T');
// baseTime: 1735689600000
// data[0].dT: 0, data[1].dT: 5000, ...
```

### 3. 大数压缩

对于递增的大 ID（如 `aggTradeId`），存储相对于基准的差值：

```typescript
import { compressLargeNumbers } from '@/lib/toon';

const { baseValue, data } = compressLargeNumbers(records, 'a');
// baseValue: 123456789
// data[0].da: 0, data[1].da: 1, data[2].da: 2, ...
```

### 4. 智能精度取整

根据价格范围动态调整精度，减少不必要的位数：

```typescript
import { smartRoundPrice } from '@/lib/toon';

// 不同价格区间使用不同精度
smartRoundPrice(0.00001234, 'BTCUSDT'); // "0.00001234" (8位)
smartRoundPrice(0.01234, 'ETHUSDT'); // "0.0123" (4位)
smartRoundPrice(50000.123, 'BTCUSDT'); // "50000.1" (1位)
```

**精度规则**：

- < 0.00001: 8 位小数（shits/mems）
- < 0.001: 6 位小数（小币）
- < 1: 4 位小数（中小币）
- < 10: 2 位小数（中等币）
- > = 10: 1 位小数（大币如 BTC/ETH）

### 5. 省略默认值

省略字段值为默认值的数据（如 `M: false`）：

```typescript
import { omitDefaultValues } from '@/lib/toon';

const data = omitDefaultValues(records, { M: false });
// 移除所有 M: false 的字段，仅保留 M: true 的记录
```

## 综合优化函数

### optimizeTradeData

适用于成交/聚合成交数据：

```typescript
import { optimizeTradeData } from '@/lib/toon';

const { baseTime, baseId, data } = optimizeTradeData(aggTrades, {
  timestampKey: 'T', // 时间戳字段
  idKey: 'a', // ID 字段（可选）
  priceKeys: ['p', 'q'], // 价格相关字段
  smartRound: true, // 启用智能取整
  symbol: symbol, // 用于精度判断
});
```

### optimizeKlineData

适用于 K 线数据：

```typescript
import { optimizeKlineData } from '@/lib/toon';

const { baseTime, data } = optimizeKlineData(klines, {
  startTimeKey: 'ot', // 开盘时间字段
  endTimeKey: 'ct', // 收盘时间字段（可选）
  priceKeys: ['o', 'h', 'l', 'c', 'v'], // 价格相关字段
  smartRound: true,
  symbol: symbol,
});
```

## 元数据格式 (metadata.json)

```json
{
  "name": "your-reader-name",
  "description": "Reader 功能描述",
  "parameters": [
    {
      "name": "symbol",
      "type": "string",
      "displayName": "交易对",
      "description": "币安交易对符号，如 BTCUSDT",
      "required": true,
      "validation": {
        "pattern": "^[A-Z]{2,20}USDT$"
      }
    },
    {
      "name": "limit",
      "type": "number",
      "displayName": "数据条数",
      "description": "获取的数据条数",
      "required": false,
      "defaultValue": 500,
      "validation": {
        "min": 1,
        "max": 1000
      }
    }
  ]
}
```

### 参数类型说明

| type    | 说明      | 验证规则        |
| ------- | --------- | --------------- |
| string  | 字符串    | pattern (正则)  |
| number  | 数字      | min, max        |
| boolean | 布尔值    | -               |
| enum    | 枚举      | enum (枚举数组) |
| object  | JSON 对象 | -               |
| array   | 数组      | -               |

## 实现模板 (index.ts)

```typescript
import { ReaderModule, ReaderInput, ReaderOutput, ReaderContext } from '@/lib/readers/types';
import { optimizeTradeData, optimizeKlineData } from '@/lib/toon';
import metadataJson from './metadata.json';
import { z } from 'zod';

// 1. 输入验证 Schema
const InputSchema = z.object({
  symbol: z.string().regex(/^[A-Z]{2,20}USDT$/, {
    message: '交易对格式错误，应为 BTCUSDT 格式',
  }),
  limit: z.number().int().min(1).max(1000).default(500),
  // 其他参数...
});

// 2. 简化的数据接口（只保留必要字段）
interface SimplifiedData {
  T: number; // timestamp
  p: string; // price
  q: string; // quantity
  m: boolean; // isBuyerMaker
}

// 3. 执行函数
async function execute(input: ReaderInput, _context: ReaderContext): Promise<ReaderOutput> {
  const startTime = Date.now();

  try {
    // 验证输入
    const { symbol, limit } = InputSchema.parse(input);

    console.log(`[Reader] Fetching data for ${symbol}, limit: ${limit}`);

    // 调用外部 API
    const response = await fetch(/* API URL */);
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    const rawData = await response.json();

    // 4. 解析并简化数据（只保留必要字段）
    const data: SimplifiedData[] = rawData.map((item) => ({
      T: item.timestamp,
      p: item.price,
      q: item.quantity,
      m: item.isBuyerMaker,
    }));

    // 5. 应用优化方案
    const { baseTime, data: optimizedData } = optimizeTradeData(
      data as unknown as Record<string, unknown>[],
      {
        timestampKey: 'T',
        priceKeys: ['p', 'q'],
        smartRound: true,
        symbol: symbol,
      }
    );

    // 6. 构建 CSV（动态生成表头）
    const keys = optimizedData.length > 0 ? Object.keys(optimizedData[0]) : ['dT', 'p', 'q', 'm'];
    const csvHeader = keys.join(',');
    const csvRows = optimizedData.map((row: Record<string, unknown>) => {
      return keys
        .map((k) => {
          const val = row[k];
          if (typeof val === 'boolean') return val ? 1 : 0;
          return val;
        })
        .join(',');
    });
    const csvData = `${csvHeader}\n${csvRows.join('\n')}`;

    // 7. 返回标准格式
    return {
      success: true,
      data: {
        s: symbol,
        fmt: 'csv',
        bT: baseTime,
        d: csvData,
        cnt: data.length,
        fa: new Date().toISOString(),
      },
      metadata: {
        executionTime: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        version: '1.0.0',
      },
    };
  } catch (error) {
    console.error('[Reader] Error:', error);

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// 8. 参数验证函数（可选但推荐）
function validate(input: ReaderInput) {
  try {
    InputSchema.parse(input);
    return { valid: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        valid: false,
        errors: error.issues.map((e) => `${e.path.join('.')}: ${e.message}`),
      };
    }
    return { valid: false, errors: ['Validation failed'] };
  }
}

// 9. 导出模块
const readerModule: ReaderModule = {
  metadata: metadataJson as ReaderModule['metadata'],
  execute,
  validate,
};

export default readerModule;
```

## 数据质量保证

### 输入验证

- 使用 Zod Schema 验证所有输入参数
- 设置合理的范围限制（如 `min: 1, max: 1000`）
- 提供清晰的错误消息

### API 错误处理

```typescript
const response = await fetch(url);
if (!response.ok) {
  const errorText = await response.text();
  throw new Error(`API请求失败: ${response.status} ${errorText}`);
}
```

### 数据完整性

- 只保留业务必要的字段
- 确保字段类型一致性
- 处理缺失值和异常值

## 常用短属性名

| 完整名称     | 短名称 | 说明         |
| ------------ | ------ | ------------ |
| symbol       | s      | 交易对       |
| price        | p      | 价格         |
| quantity     | q      | 数量         |
| timestamp    | T, t   | 时间戳       |
| openTime     | ot     | 开盘时间     |
| open         | o      | 开盘价       |
| high         | h      | 最高价       |
| low          | l      | 最低价       |
| close        | c      | 收盘价       |
| volume       | v      | 成交量       |
| isBuyerMaker | m      | 是否买方挂单 |
| count        | cnt    | 计数         |
| interval     | i      | 周期         |
| delta        | d      | 差值/增量    |
| base         | b      | 基准值       |
| fetchedAt    | fa     | 获取时间     |
| format       | fmt    | 格式         |

## 执行上下文 (ReaderContext)

```typescript
interface ReaderContext {
  readerId: string; // Reader 名称
  requestId: string; // 请求 ID (UUID)
  triggeredBy: string; // 触发来源 ('api', 'manual', 'scheduler')
  timestamp: string; // 执行时间戳
  environment: 'development' | 'production'; // 运行环境
}
```

## 返回值格式 (ReaderOutput)

```typescript
interface ReaderOutput<T = unknown> {
  success: boolean; // 执行是否成功
  data?: T; // 返回数据（成功时）
  error?: string; // 错误信息（失败时）
  metadata?: {
    executionTime: number; // 执行耗时（毫秒）
    timestamp: string; // 时间戳
    version: string; // 版本号
  };
}
```

## 最佳实践

1. **保持专注** - 每个 Reader 只做一件事
2. **验证优先** - 始终验证输入参数
3. **错误友好** - 提供清晰的错误消息
4. **合理限制** - 设置默认值和范围限制
5. **日志输出** - 使用 `console.log` 输出关键信息（带 `[Reader]` 前缀）
6. **精度权衡** - 在精度和 token 消耗之间找到平衡
7. **测试充分** - 测试边界情况和异常输入

## 性能考虑

- 优化方案通常可减少 **40-60%** 的 token 使用
- 对于大量数据（100+ 条记录），效果更明显
- CSV 格式化开销可忽略不计
- 主要节省在 LLM API 调用成本

## 完整示例

参见以下已验证的 Reader：

1. **binance-agg-trades** - 聚合成交数据
   - 文件：`readers/binance-agg-trades/index.ts`
   - 优化：相对时间戳、智能取整、大数压缩

2. **kline-fetcher** - K线数据
   - 文件：`readers/kline-fetcher/index.ts`
   - 优化：相对时间戳、OHLCV 精度优化
