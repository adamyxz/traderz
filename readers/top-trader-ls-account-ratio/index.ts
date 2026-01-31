import { ReaderModule, ReaderInput, ReaderOutput } from '@/lib/readers/types';
import { toRelativeTimestamps, trimPrice, toCompactCSV } from '@/lib/toon';
import metadataJson from './metadata.json';
import { z } from 'zod';

// 输入验证
const periodEnum = z.enum(['5m', '15m', '30m', '1h', '2h', '4h', '6h', '12h', '1d']);

const InputSchema = z.object({
  symbol: z.string().regex(/^[A-Z]{2,20}USDT$/, { message: '交易对格式错误，应为 BTCUSDT 格式' }),
  period: periodEnum,
  limit: z.number().int().min(1).max(500).default(30),
  startTime: z.number().int().min(0).optional(),
  endTime: z.number().int().min(0).optional(),
});

// 简化的大户账户数多空比数据
interface SimplifiedRatio {
  T: number; // timestamp
  r: string; // ratio (longShortRatio)
  l: string; // longAccount
  s: string; // shortAccount
}

// 执行函数
async function execute(input: ReaderInput): Promise<ReaderOutput> {
  const startTime = Date.now();

  try {
    // 验证输入
    const { symbol, period, limit, startTime: startTs, endTime: endTs } = InputSchema.parse(input);

    console.log(
      `[Reader] Fetching top trader LS account ratio for ${symbol} ${period}, limit: ${limit}`
    );

    // 构建币安永续合约API请求
    const baseUrl = 'https://fapi.binance.com/futures/data/topLongShortAccountRatio';
    const params = new URLSearchParams({
      symbol: symbol.toUpperCase(),
      period,
      limit: limit.toString(),
    });

    if (startTs) {
      params.append('startTime', startTs.toString());
    }
    if (endTs) {
      params.append('endTime', endTs.toString());
    }

    const url = `${baseUrl}?${params.toString()}`;

    // 调用币安API
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`币安API请求失败: ${response.status} ${errorText}`);
    }

    const rawData = await response.json();

    // 验证返回数据格式
    if (!Array.isArray(rawData)) {
      throw new Error(`API返回数据格式错误: 期望数组, 实际 ${typeof rawData}`);
    }

    if (rawData.length === 0) {
      throw new Error('API未返回任何数据');
    }

    // 解析数据 - 简化字段名
    const data: SimplifiedRatio[] = rawData.map((item: unknown, idx: number) => {
      if (!item || typeof item !== 'object') {
        throw new Error(`数据项 ${idx} 格式错误`);
      }
      const record = item as Record<string, unknown>;
      if (!record.timestamp) {
        throw new Error(`数据项 ${idx} 缺少 timestamp 字段`);
      }
      return {
        T: Number(record.timestamp),
        r: trimPrice(String(record.longShortRatio || 0)),
        l: trimPrice(String(record.longAccount || 0)),
        s: trimPrice(String(record.shortAccount || 0)),
      };
    });

    // 应用相对时间戳优化
    const { baseTime, records: optimizedData } = toRelativeTimestamps(
      data as unknown as Record<string, unknown>[],
      'T'
    );

    // 验证优化后的数据
    if (!optimizedData || !Array.isArray(optimizedData)) {
      throw new Error('数据优化失败');
    }

    // 构建超紧凑CSV - 移除时间戳列, 行序隐含时间顺序
    const csvData = toCompactCSV(optimizedData, {
      excludeColumns: ['dT'], // 移除相对时间戳
      defaultValuePlaceholder: '', // 0值用空字符串表示
    });

    const result = {
      s: symbol,
      p: period,
      fmt: 'csv',
      bT: baseTime,
      d: csvData,
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
    console.error('[Reader] Error:', error);

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
        errors: error.issues.map((e) => `${e.path.join('.')}: ${e.message}`),
      };
    }
    return { valid: false, errors: ['Validation failed'] };
  }
}

// 导出模块
const readerModule: ReaderModule = {
  metadata: metadataJson as ReaderModule['metadata'],
  execute,
  validate,
};

export default readerModule;
