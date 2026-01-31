import { ReaderModule, ReaderInput, ReaderOutput, ReaderContext } from '@/lib/readers/types';
import { toRelativeTimestamps, trimPrice, toCompactCSV } from '@/lib/toon';
import metadataJson from './metadata.json';
import { z } from 'zod';

// Input validation
const periodEnum = z.enum(['5m', '15m', '30m', '1h', '2h', '4h', '6h', '12h', '1d']);

const InputSchema = z.object({
  symbol: z.string().regex(/^[A-Z]{2,20}USDT$/, {
    message: 'Invalid trading pair format, expected BTCUSDT format',
  }),
  period: periodEnum.default('5m'),
  limit: z.number().int().min(1).max(500).default(100),
  endTime: z.number().int().min(0).default(0),
});

// Simplified open interest data type
interface SimplifiedOpenInterest {
  T: number; // timestamp
  oi: string; // openInterest (sum of open interest)
  oiv: string; // openInterestValue (sum of open interest value in USDT)
}

// Execute function
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function execute(input: ReaderInput, _context: ReaderContext): Promise<ReaderOutput> {
  const startTime = Date.now();

  try {
    // Validate input
    const { symbol, period, limit, endTime } = InputSchema.parse(input);

    console.log(`[Reader] Fetching open interest history for ${symbol} ${period}, limit: ${limit}`);

    // Build Binance perpetual futures API request
    const baseUrl = 'https://fapi.binance.com/futures/data/openInterestHist';
    const params = new URLSearchParams({
      symbol: symbol.toUpperCase(),
      period,
      limit: limit.toString(),
    });

    // If end time is specified, add to parameters
    if (endTime > 0) {
      params.append('endTime', endTime.toString());
    }

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

    // Parse open interest data
    // Binance returns: object array
    // [{"symbol":"BTCUSDT","sumOpenInterest":"102398.47","sumOpenInterestValue":"8495950520.42","timestamp":1769793600000}, ...]
    if (!rawData || !Array.isArray(rawData) || rawData.length === 0) {
      throw new Error('API returned empty data or format error');
    }

    const data: SimplifiedOpenInterest[] = rawData.map((tick: Record<string, string>) => ({
      T: Number(tick.timestamp),
      oi: trimPrice(String(tick.sumOpenInterest)),
      oiv: trimPrice(String(tick.sumOpenInterestValue)),
    }));

    // Apply optimization: relative timestamps
    const { baseTime, records: optimizedData } = toRelativeTimestamps(
      data as unknown as Record<string, unknown>[],
      'T'
    );

    // Build ultra-compact CSV - remove timestamp column, row order implies time sequence
    const csvData = toCompactCSV(optimizedData, {
      excludeColumns: ['dT'], // Remove relative timestamp
      defaultValuePlaceholder: '', // Use empty string for 0 values
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
