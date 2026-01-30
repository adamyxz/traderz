import { ReaderModule, ReaderInput, ReaderOutput } from '@/lib/readers/types';
import { toRelativeTimestamps, trimPrice } from '@/lib/toon';
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

// 简化的基差数据
interface SimplifiedBasis {
  T: number; // timestamp
  b: string; // basis (基差)
  r: string; // basisRate (基差率)
  p: string; // indexPrice (指数价格)
  f: string; // futuresPrice (合约价格)
}

// 执行函数
async function execute(input: ReaderInput): Promise<ReaderOutput> {
  const startTime = Date.now();

  try {
    // 验证输入
    const { symbol, period, limit, startTime: startTs, endTime: endTs } = InputSchema.parse(input);

    console.log(`[Reader] Fetching basis data for ${symbol} ${period}, limit: ${limit}`);

    // 构建币安永续合约API请求
    const baseUrl = 'https://fapi.binance.com/futures/data/basis';
    const params = new URLSearchParams({
      pair: symbol.toUpperCase(),
      period,
      contractType: 'PERPETUAL',
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

    // 验证返回数据格式 - basis API 可能返回包含 data 字段的对象
    let dataArray: unknown[] = [];
    if (Array.isArray(rawData)) {
      dataArray = rawData;
    } else if (
      rawData &&
      typeof rawData === 'object' &&
      'data' in rawData &&
      Array.isArray(rawData.data)
    ) {
      dataArray = rawData.data;
    } else {
      throw new Error(
        `API返回数据格式错误: 期望数组或包含data字段的对象, 实际 ${JSON.stringify(rawData).slice(0, 200)}`
      );
    }

    if (dataArray.length === 0) {
      throw new Error('API未返回任何数据');
    }

    // 解析数据 - 简化字段名
    const data: SimplifiedBasis[] = dataArray.map((item: unknown, idx: number) => {
      if (!item || typeof item !== 'object') {
        throw new Error(`数据项 ${idx} 格式错误`);
      }
      const record = item as Record<string, unknown>;
      if (!record.timestamp) {
        throw new Error(`数据项 ${idx} 缺少 timestamp 字段`);
      }
      return {
        T: Number(record.timestamp),
        b: trimPrice(String(record.basis || 0)),
        r: trimPrice(String(record.basisRate || 0)),
        p: trimPrice(String(record.indexPrice || 0)),
        f: trimPrice(String(record.futuresPrice || 0)),
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

    // 构建CSV
    const keys =
      optimizedData.length > 0 ? Object.keys(optimizedData[0]) : ['dT', 'b', 'r', 'p', 'f'];
    const csvHeader = keys.join(',');
    const csvRows = optimizedData.map((row: Record<string, unknown>) => {
      return keys.map((k) => row[k]).join(',');
    });
    const csvData = `${csvHeader}\n${csvRows.join('\n')}`;

    const result = {
      s: symbol,
      p: period,
      fmt: 'csv',
      bT: baseTime,
      d: csvData,
      cnt: data.length,
      fa: new Date().toISOString(),
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
