import { ReaderModule, ReaderInput, ReaderOutput, ReaderContext } from '@/lib/readers/types';
import { toRelativeTimestamps, trimPrice, toCompactCSV } from '@/lib/toon';
import metadataJson from './metadata.json';
import { z } from 'zod';

// 输入验证
const periodEnum = z.enum(['5m', '15m', '30m', '1h', '2h', '4h', '6h', '12h', '1d']);

const InputSchema = z.object({
  symbol: z.string().regex(/^[A-Z]{2,20}USDT$/, {
    message: '交易对格式错误，应为 BTCUSDT 格式',
  }),
  period: periodEnum.default('5m'),
  limit: z.number().int().min(1).max(500).default(100),
  endTime: z.number().int().min(0).default(0),
});

// 简化的持仓量数据类型
interface SimplifiedOpenInterest {
  T: number; // timestamp
  oi: string; // openInterest (sum of open interest)
  oiv: string; // openInterestValue (sum of open interest value in USDT)
}

// 执行函数
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function execute(input: ReaderInput, _context: ReaderContext): Promise<ReaderOutput> {
  const startTime = Date.now();

  try {
    // 验证输入
    const { symbol, period, limit, endTime } = InputSchema.parse(input);

    console.log(`[Reader] Fetching open interest history for ${symbol} ${period}, limit: ${limit}`);

    // 构建币安永续合约API请求
    const baseUrl = 'https://fapi.binance.com/futures/data/openInterestHist';
    const params = new URLSearchParams({
      symbol: symbol.toUpperCase(),
      period,
      limit: limit.toString(),
    });

    // 如果指定了结束时间，添加到参数中
    if (endTime > 0) {
      params.append('endTime', endTime.toString());
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

    // 解析持仓量数据
    // 币安返回格式: 对象数组
    // [{"symbol":"BTCUSDT","sumOpenInterest":"102398.47","sumOpenInterestValue":"8495950520.42","timestamp":1769793600000}, ...]
    if (!rawData || !Array.isArray(rawData) || rawData.length === 0) {
      throw new Error('API返回数据为空或格式错误');
    }

    const data: SimplifiedOpenInterest[] = rawData.map((tick: Record<string, string>) => ({
      T: Number(tick.timestamp),
      oi: trimPrice(String(tick.sumOpenInterest)),
      oiv: trimPrice(String(tick.sumOpenInterestValue)),
    }));

    // 应用优化方案：相对时间戳
    const { baseTime, records: optimizedData } = toRelativeTimestamps(
      data as unknown as Record<string, unknown>[],
      'T'
    );

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
