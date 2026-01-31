import { ReaderModule, ReaderInput, ReaderOutput, ReaderContext } from '@/lib/readers/types';
import { optimizeKlineData, toCompactCSV } from '@/lib/toon';
import metadataJson from './metadata.json';
import { z } from 'zod';

// Input validation
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
    message: 'Invalid trading pair format, expected BTCUSDT format',
  }),
  interval: intervalEnum,
  limit: z.number().int().min(1).max(1000).default(100),
  endTime: z.number().int().min(0).default(0),
});

// Simplified K-line data type - only keep OHLCV
interface SimplifiedKline {
  ot: number; // openTime
  o: string; // open
  h: string; // high
  l: string; // low
  c: string; // close
  v: string; // volume
}

// Execute function
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function execute(input: ReaderInput, _context: ReaderContext): Promise<ReaderOutput> {
  const startTime = Date.now();

  try {
    // Validate input
    const { symbol, interval, limit, endTime } = InputSchema.parse(input);

    console.log(`[Reader] Fetching klines for ${symbol} ${interval}, limit: ${limit}`);

    // Build Binance perpetual futures API request
    const baseUrl = 'https://fapi.binance.com/fapi/v1/continuousKlines';
    const params = new URLSearchParams({
      pair: symbol.toUpperCase(),
      contractType: 'PERPETUAL',
      interval,
      limit: limit.toString(),
    });

    // If end time is specified, add to parameters
    const endTimeMs = endTime > 0 ? endTime : Date.now();
    params.append('endTime', endTimeMs.toString());

    const url = `${baseUrl}?${params.toString()}`;

    // Call Binance API
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Binance API request failed: ${response.status} ${errorText}`);
    }

    const rawData = await response.json();

    // Parse K-line data - only keep OHLCV fields
    // Binance returns: [openTime, open, high, low, close, volume, closeTime, quoteVolume, trades, takerBuyBaseVolume, takerBuyQuoteVolume]
    const klines: SimplifiedKline[] = rawData.map((tick: (string | number)[]) => ({
      ot: tick[0],
      o: tick[1],
      h: tick[2],
      l: tick[3],
      c: tick[4],
      v: tick[5],
    }));

    // Apply 5 optimizations: price precision, relative timestamps, etc.
    const { baseTime, data: optimizedKlines } = optimizeKlineData(
      klines as unknown as Record<string, unknown>[],
      {
        startTimeKey: 'ot',
        priceKeys: ['o', 'h', 'l', 'c', 'v'],
        smartRound: true,
        symbol: symbol,
      }
    );

    // Build ultra-compact CSV - remove timestamp column, row order implies time sequence
    const csvData = toCompactCSV(optimizedKlines, {
      excludeColumns: ['dot'], // Remove relative timestamp
      defaultValuePlaceholder: '', // Use empty string for 0 values
    });

    const result = {
      s: symbol,
      i: interval,
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

// Parameter validation
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

// Export module
const readerModule: ReaderModule = {
  metadata: metadataJson as ReaderModule['metadata'],
  execute,
  validate,
};

export default readerModule;
