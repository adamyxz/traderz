import { ReaderModule, ReaderInput, ReaderOutput, ReaderContext } from '@/lib/readers/types';
import { toRelativeTimestamps, trimPrice, toCompactCSV } from '@/lib/toon';
import metadataJson from './metadata.json';
import { z } from 'zod';

// 输入验证
const InputSchema = z.object({
  symbol: z
    .string()
    .regex(/^$|^[A-Z]{2,20}USDT$/, {
      message: '交易对格式错误，应为 BTCUSDT 格式或留空',
    })
    .optional()
    .default(''),
  limit: z.coerce.number().min(1).max(1000).optional().default(100),
});

// 资金费率历史类型
interface FundingRateInfo {
  T: number; // fundingTime
  s: string; // symbol
  fr: string; // fundingRate
  mp: string; // markPrice
}

// 执行函数
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function execute(input: ReaderInput, _context: ReaderContext): Promise<ReaderOutput> {
  const startTime = Date.now();

  try {
    // 验证输入
    const { symbol, limit } = InputSchema.parse(input);

    console.log(`[Reader] Fetching funding rate history${symbol ? ' for ' + symbol : ''}`);

    // 构建币安API请求
    const baseUrl = 'https://fapi.binance.com/fapi/v1/fundingRate';
    const params = new URLSearchParams();

    // 如果指定了 symbol，添加到参数中
    if (symbol && symbol.trim() !== '') {
      params.append('symbol', symbol.toUpperCase());
    }

    // 添加 limit 参数
    params.append('limit', limit.toString());

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

    // 解析资金费率历史数据
    const fundingRates: FundingRateInfo[] = rawData.map(
      (item: { symbol: string; fundingRate: string; fundingTime: number; markPrice: string }) => ({
        T: item.fundingTime,
        s: item.symbol,
        fr: trimPrice(item.fundingRate),
        mp: trimPrice(item.markPrice),
      })
    );

    // 如果没有数据，返回空结果
    if (fundingRates.length === 0) {
      return {
        success: true,
        data: {
          fmt: 'csv',
          s: symbol || '',
          d: '',
        },
        metadata: {
          executionTime: Date.now() - startTime,
          timestamp: new Date().toISOString(),
          version: '1.0.0',
        },
      };
    }

    // 应用相对时间戳优化
    const { baseTime, records: optimizedData } = toRelativeTimestamps(
      fundingRates as unknown as Record<string, unknown>[],
      'T'
    );

    // 验证优化后的数据
    if (!optimizedData || !Array.isArray(optimizedData)) {
      throw new Error('数据优化失败');
    }

    // 构建超紧凑CSV - 移除时间戳和交易对列
    const csvData = toCompactCSV(optimizedData, {
      excludeColumns: ['dT', 's'], // 移除相对时间戳和交易对
      defaultValuePlaceholder: '', // 0值用空字符串表示
    });

    const result = {
      fmt: 'csv',
      s: symbol || 'ALL', // symbol or ALL if empty
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
