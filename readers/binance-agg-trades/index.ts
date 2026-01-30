import { ReaderModule, ReaderInput, ReaderOutput, ReaderContext } from '@/lib/readers/types';
import { toTOONTable } from '@/lib/toon';
import metadataJson from './metadata.json';
import { z } from 'zod';

// 输入验证
const InputSchema = z.object({
  symbol: z.string().regex(/^[A-Z]{2,20}USDT$/, {
    message: '交易对格式错误，应为 BTCUSDT 格式',
  }),
  limit: z.number().int().min(1).max(1000).default(500),
  startTime: z.number().int().min(0).default(0),
  endTime: z.number().int().min(0).default(0),
  fromId: z.number().int().min(0).default(0),
});

// 聚合成交数据类型
interface AggTrade {
  a: number; // 聚合交易ID (aggTradeId)
  p: string; // 成交价格 (price)
  q: string; // 成交数量 (quantity)
  f: number; // 第一个交易ID (firstTradeId)
  l: number; // 最后一个交易ID (lastTradeId)
  T: number; // 成交时间戳 (timestamp)
  m: boolean; // 是否为买方做市商 (isBuyerMaker)
  M: boolean; // 是否被忽略 (wasIgnored)
}

// 执行函数
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function execute(input: ReaderInput, _context: ReaderContext): Promise<ReaderOutput> {
  const startTime = Date.now();

  try {
    // 验证输入
    const { symbol, limit, startTime: startTimeParam, endTime, fromId } = InputSchema.parse(input);

    console.log(`[Reader] Fetching aggTrades for ${symbol}, limit: ${limit}`);

    // 构建币安API请求
    const baseUrl = 'https://api.binance.com/api/v3/aggTrades';
    const params = new URLSearchParams({
      symbol: symbol.toUpperCase(),
      limit: limit.toString(),
    });

    // 添加可选参数
    if (fromId > 0) {
      params.append('fromId', fromId.toString());
    }

    if (startTimeParam > 0) {
      params.append('startTime', startTimeParam.toString());
    }

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

    // 解析聚合成交数据为紧凑格式
    // 币安返回格式: { a: aggTradeId, p: price, q: quantity, f: firstTradeId, l: lastTradeId, T: timestamp, m: isBuyerMaker, M: wasIgnored }
    const aggTrades: AggTrade[] = rawData.map(
      (tick: {
        a: number;
        p: string;
        q: string;
        f: number;
        l: number;
        T: number;
        m: boolean;
        M?: boolean;
      }) => ({
        a: tick.a,
        p: tick.p,
        q: tick.q,
        f: tick.f,
        l: tick.l,
        T: tick.T,
        m: tick.m,
        M: tick.M || false,
      })
    );

    // 使用 TOON 格式输出 (压缩上下文)
    const toonData = toTOONTable(aggTrades as unknown as Record<string, unknown>[], [
      'a',
      'T',
      'p',
      'q',
      'f',
      'l',
      'm',
      'M',
    ]);

    const result = {
      s: symbol,
      d: toonData,
      cnt: aggTrades.length,
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
