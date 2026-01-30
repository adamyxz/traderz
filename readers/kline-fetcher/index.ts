import { ReaderModule, ReaderInput, ReaderOutput, ReaderContext } from '@/lib/readers/types';
import { toTOONTable } from '@/lib/toon';
import metadataJson from './metadata.json';
import { z } from 'zod';

// 输入验证
const intervalEnum = z.enum([
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
]);

const InputSchema = z.object({
  symbol: z.string().regex(/^[A-Z]{2,20}USDT$/, {
    message: '交易对格式错误，应为 BTCUSDT 格式',
  }),
  interval: intervalEnum,
  limit: z.number().int().min(1).max(1000).default(100),
  endTime: z.number().int().min(0).default(0),
});

// K线数据类型 (使用短属性名)
interface KlineTick {
  ot: number; // openTime
  o: string; // open
  h: string; // high
  l: string; // low
  c: string; // close
  v: string; // volume
  ct: number; // closeTime
  qv: string; // quoteVolume
  n: number; // trades
  tbv: string; // takerBuyBaseVolume
  tqv: string; // takerBuyQuoteVolume
}

// 执行函数
// eslint-disable-next-line @typescript-eslint/no-unused-vars
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

    // 解析K线数据为紧凑格式
    // 币安返回格式: [openTime, open, high, low, close, volume, closeTime, quoteVolume, trades, takerBuyBaseVolume, takerBuyQuoteVolume]
    const klines: KlineTick[] = rawData.map((tick: (string | number)[]) => ({
      ot: tick[0],
      o: tick[1],
      h: tick[2],
      l: tick[3],
      c: tick[4],
      v: tick[5],
      ct: tick[6],
      qv: tick[7],
      n: tick[8],
      tbv: tick[9],
      tqv: tick[10],
    }));

    // 使用 TOON 格式输出 (压缩上下文)
    const toonData = toTOONTable(klines as unknown as Record<string, unknown>[], [
      'ot',
      'o',
      'h',
      'l',
      'c',
      'v',
      'ct',
      'qv',
      'n',
      'tbv',
      'tqv',
    ]);

    const result = {
      s: symbol,
      i: interval,
      d: toonData,
      cnt: klines.length,
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
