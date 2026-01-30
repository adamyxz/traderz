import { ReaderModule, ReaderInput, ReaderOutput, ReaderContext } from '@/lib/readers/types';
import { z } from 'zod';

// 输入验证
const InputSchema = z.object({
  symbol: z.string().regex(/^[A-Z]{2,20}USDT$/, {
    message: '交易对格式错误，应为 BTCUSDT 格式',
  }),
  interval: z.enum(
    [
      '1s',
      '1m',
      '3m',
      '5m',
      '15m',
      '30m',
      '1h',
      '2h',
      '4h',
      '6h',
      '8h',
      '12h',
      '1d',
      '3d',
      '1w',
      '1M',
    ],
    {
      errorMap: () => ({
        message:
          '周期必须是 1s, 1m, 3m, 5m, 15m, 30m, 1h, 2h, 4h, 6h, 8h, 12h, 1d, 3d, 1w, 1M 之一',
      }),
    }
  ),
  limit: z.number().int().min(1).max(1000).default(100),
  endTime: z.number().int().min(0).default(0),
});

// K线数据类型
interface KlineTick {
  openTime: number;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  closeTime: number;
  quoteVolume: string;
  trades: number;
  takerBuyBaseVolume: string;
  takerBuyQuoteVolume: string;
}

// 执行函数
async function execute(input: ReaderInput, _context: ReaderContext): Promise<ReaderOutput> {
  const startTime = Date.now();

  try {
    // 验证输入
    const { symbol, interval, limit, endTime } = InputSchema.parse(input);

    console.log(`[Reader] Fetching klines for ${symbol} ${interval}, limit: ${limit}`);

    // 构建币安API请求
    const baseUrl = 'https://api.binance.com/api/v3/klines';
    const params = new URLSearchParams({
      symbol: symbol.toUpperCase(),
      interval,
      limit: limit.toString(),
    });

    // 如果指定了结束时间，添加到参数中
    const endTimeMs = endTime > 0 ? endTime : Date.now();
    params.append('endTime', endTimeMs.toString());

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

    // 解析K线数据
    // 币安返回格式: [openTime, open, high, low, close, volume, closeTime, quoteVolume, trades, takerBuyBaseVolume, takerBuyQuoteVolume]
    const klines: KlineTick[] = rawData.map((tick: (string | number)[]) => ({
      openTime: tick[0],
      open: tick[1],
      high: tick[2],
      low: tick[3],
      close: tick[4],
      volume: tick[5],
      closeTime: tick[6],
      quoteVolume: tick[7],
      trades: tick[8],
      takerBuyBaseVolume: tick[9],
      takerBuyQuoteVolume: tick[10],
    }));

    const result = {
      symbol,
      interval,
      klines,
      count: klines.length,
      fetchedAt: new Date().toISOString(),
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
