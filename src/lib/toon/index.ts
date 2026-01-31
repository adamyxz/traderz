/**
 * TOON (Token-Oriented Object Notation) Format
 *
 * A compact notation format optimized for LLM context compression.
 * Removes unnecessary tokens while maintaining readability.
 */

type ToonValue = string | number | boolean | null | ToonObject | ToonValue[];
interface ToonObject {
  [key: string]: ToonValue;
}

/**
 * Convert a JavaScript object to TOON format
 * Uses compact notation with minimal whitespace and short keys
 */
export function toToON(obj: ToonValue, indent = 0): string {
  const spaces = '  '.repeat(indent);

  if (obj === null) {
    return 'null';
  }

  if (obj === undefined) {
    return 'undefined';
  }

  if (typeof obj === 'string') {
    return `"${obj}"`;
  }

  if (typeof obj === 'number' || typeof obj === 'boolean') {
    return String(obj);
  }

  if (Array.isArray(obj)) {
    if (obj.length === 0) {
      return '[]';
    }

    // Simple array - inline if elements are simple
    const allSimple = obj.every((item) => typeof item !== 'object' || item === null);
    if (allSimple && obj.length < 5) {
      return `[${obj.map((v) => toToON(v, 0)).join(',')}]`;
    }

    // Complex array - multi-line
    return `[\n${obj.map((item) => `${spaces}  ${toToON(item, indent + 1)}`).join(',\n')}\n${spaces}]`;
  }

  if (typeof obj === 'object') {
    const keys = Object.keys(obj);
    if (keys.length === 0) {
      return '{}';
    }

    // Shorten property names for common fields
    const shortKeys: Record<string, string> = {
      aggTradeId: 'a',
      price: 'p',
      quantity: 'q',
      firstTradeId: 'f',
      lastTradeId: 'l',
      timestamp: 'T',
      isBuyerMaker: 'm',
      wasIgnored: 'M',
      openTime: 'ot',
      open: 'o',
      high: 'h',
      low: 'l',
      close: 'c',
      volume: 'v',
      closeTime: 'ct',
      quoteVolume: 'qv',
      trades: 'n',
      takerBuyBaseVolume: 'tbv',
      takerBuyQuoteVolume: 'tqv',
      symbol: 's',
      interval: 'i',
      count: 'cnt',
      fetchedAt: 'fa',
      executionTime: 'et',
      version: 'ver',
    };

    const entries = keys.map((key) => {
      const shortKey = shortKeys[key] || key;
      const value = toToON(obj[key], indent + 1);
      return `${spaces}  ${shortKey}=${value}`;
    });

    return `{\n${entries.join(',\n')}\n${spaces}}`;
  }

  return String(obj);
}

/**
 * Parse TOON format back to JavaScript object
 * Note: This is a simplified parser for basic TOON format
 */
export function parseTOON(toonString: string): ToonValue {
  // Convert TOON key=value format to JSON
  const jsonStr = toonString.replace(/(\w+)=/g, '"$1":').replace(/'/g, '"');

  return JSON.parse(jsonStr);
}

/**
 * Create a TOON formatter with custom key mappings
 */
export function createTOONFormatter(customShortKeys: Record<string, string>) {
  return (obj: ToonValue, indent = 0): string => {
    const spaces = '  '.repeat(indent);

    if (obj === null || typeof obj !== 'object') {
      return toToON(obj, indent);
    }

    if (Array.isArray(obj)) {
      if (obj.length === 0) return '[]';
      const allSimple = obj.every((item) => typeof item !== 'object');
      if (allSimple && obj.length < 5) {
        return `[${obj.map((v) => createTOONFormatter(customShortKeys)(v, 0)).join(',')}]`;
      }
      return `[\n${obj.map((item) => `${spaces}  ${createTOONFormatter(customShortKeys)(item, indent + 1)}`).join(',\n')}\n${spaces}]`;
    }

    const keys = Object.keys(obj);
    if (keys.length === 0) return '{}';

    const entries = keys.map((key) => {
      const shortKey = customShortKeys[key] || key;
      const value = createTOONFormatter(customShortKeys)(obj[key], indent + 1);
      return `${spaces}  ${shortKey}=${value}`;
    });

    return `{\n${entries.join(',\n')}\n${spaces}}`;
  };
}

/**
 * Format array of objects to compact TOON table format
 * Useful for tabular data like trades or klines
 */
export function toTOONTable(arr: Record<string, unknown>[], keyOrder?: string[]): string {
  if (arr.length === 0) return '[]';

  // Get all keys from first object, or use provided order
  const keys = keyOrder || Object.keys(arr[0]);

  // Format as array with inline objects
  const items = arr.map((obj) => {
    const pairs = keys
      .filter((k) => k in obj)
      .map((k) => {
        const shortKey = k;
        const val = toToON(obj[k] as ToonValue, 0);
        return `${shortKey}=${val}`;
      });
    return `{${pairs.join(',')}}`;
  });

  return `[\n  ${items.join('\n  ')}\n]`;
}

// ============================================================================
// OPTIMIZATION FUNCTIONS FOR DATA COMPRESSION
// ============================================================================

/**
 * Optimization 1: Smart precision - Remove trailing zeros from price strings
 */
export function trimPrice(price: string | number): string {
  const num = typeof price === 'string' ? parseFloat(price) : price;
  return num.toString();
}

/**
 * Optimization 4: Dynamic rounding based on price range and symbol
 */
export function smartRoundPrice(price: string | number): string {
  const num = typeof price === 'string' ? parseFloat(price) : price;

  // Different thresholds for different price ranges
  if (num < 0.00001) {
    return num.toFixed(8); // Very small coins (shits/mems)
  } else if (num < 0.001) {
    return num.toFixed(6); // Small coins
  } else if (num < 1) {
    return num.toFixed(4); // Medium-small coins
  } else if (num < 10) {
    return num.toFixed(2); // Medium coins
  } else {
    return num.toFixed(1); // Large coins (BTC, ETH)
  }
}

/**
 * Optimization 2: Convert absolute timestamps to relative deltas
 * Returns base timestamp and array of relative time deltas
 */
export function toRelativeTimestamps(
  records: Record<string, unknown>[],
  timestampKey: string
): { baseTime: number; records: Record<string, unknown>[] } {
  if (records.length === 0) {
    return { baseTime: 0, records: [] };
  }

  const baseTime = records[0][timestampKey] as number;
  const deltaKey = `d${timestampKey}`; // delta key, e.g., dT for timestamp T

  const processedRecords = records.map((record, index) => {
    const newRecord = { ...record };
    const currentTimestamp = newRecord[timestampKey] as number;
    const delta = index === 0 ? 0 : currentTimestamp - baseTime;
    newRecord[deltaKey] = delta;
    delete newRecord[timestampKey];
    return newRecord;
  });

  return { baseTime, records: processedRecords };
}

/**
 * Optimization 3: Compress large numbers by removing redundant digits
 * For IDs that increment sequentially, store relative to base
 */
export function compressLargeNumbers(
  records: Record<string, unknown>[],
  key: string
): { baseValue: number; records: Record<string, unknown>[] } {
  if (records.length === 0) {
    return { baseValue: 0, records: [] };
  }

  const baseValue = records[0][key] as number;
  const deltaKey = `d${key}`;

  const processedRecords = records.map((record, index) => {
    const newRecord = { ...record };
    const currentValue = newRecord[key] as number;

    // If the value is large and sequential, use delta
    if (currentValue > 1000000 && index < records.length - 1) {
      newRecord[deltaKey] = currentValue - baseValue;
      delete newRecord[key];
    }

    return newRecord;
  });

  return { baseValue, records: processedRecords };
}

/**
 * Optimization 5: Omit fields with default values
 */
export function omitDefaultValues(
  records: Record<string, unknown>[],
  defaults: Record<string, unknown>
): Record<string, unknown>[] {
  return records.map((record) => {
    const newRecord: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(record)) {
      const defaultValue = defaults[key];
      if (value !== defaultValue) {
        newRecord[key] = value;
      }
    }
    return newRecord;
  });
}

/**
 * Apply all optimizations to trade/agg trade data
 */
export function optimizeTradeData(
  trades: Record<string, unknown>[],
  options: {
    timestampKey?: string;
    idKey?: string;
    priceKeys?: string[];
    smartRound?: boolean;
    symbol?: string;
  } = {}
): {
  baseTime: number;
  baseId?: number;
  data: Record<string, unknown>[];
} {
  const { timestampKey = 'T', idKey = 'a', priceKeys = ['p'], smartRound = true } = options;

  let processedTrades = [...trades];

  // Opt 1 & 4: Trim and round prices
  processedTrades = processedTrades.map((trade) => {
    const newTrade = { ...trade };
    priceKeys.forEach((key) => {
      if (key in newTrade) {
        const priceValue = newTrade[key] as string | number;
        newTrade[key] = smartRound ? smartRoundPrice(priceValue) : trimPrice(priceValue);
      }
    });
    return newTrade;
  });

  // Opt 2: Relative timestamps
  const { baseTime, records: tradesWithRelativeTime } = toRelativeTimestamps(
    processedTrades,
    timestampKey
  );
  processedTrades = tradesWithRelativeTime;

  // Opt 3: Compress large IDs
  let baseId: number | undefined;
  if (idKey && processedTrades.length > 0 && idKey in processedTrades[0]) {
    const { baseValue, records: tradesWithCompressedIds } = compressLargeNumbers(
      processedTrades,
      idKey
    );
    baseId = baseValue;
    processedTrades = tradesWithCompressedIds;
  }

  // Opt 5: Omit default values (M=false is the default)
  processedTrades = omitDefaultValues(processedTrades, { M: false });

  return { baseTime, baseId, data: processedTrades };
}

/**
 * Apply all optimizations to kline data
 */
export function optimizeKlineData(
  klines: Record<string, unknown>[],
  options: {
    startTimeKey?: string;
    endTimeKey?: string;
    priceKeys?: string[];
    smartRound?: boolean;
    symbol?: string;
  } = {}
): {
  baseTime: number;
  data: Record<string, unknown>[];
} {
  const { startTimeKey = 'ot', priceKeys = ['o', 'h', 'l', 'c'], smartRound = true } = options;

  let processedKlines = [...klines];

  // Opt 1 & 4: Trim and round prices
  processedKlines = processedKlines.map((kline) => {
    const newKline = { ...kline };
    priceKeys.forEach((key) => {
      if (key in newKline) {
        const priceValue = newKline[key] as string | number;
        newKline[key] = smartRound ? smartRoundPrice(priceValue) : trimPrice(priceValue);
      }
    });
    // Also optimize volume fields
    ['v', 'qv', 'tbv', 'tqv'].forEach((key) => {
      if (key in newKline) {
        const value = newKline[key] as string | number;
        newKline[key] = trimPrice(value);
      }
    });
    return newKline;
  });

  // Opt 2: Relative timestamps for open time (close time can be derived)
  const { baseTime, records: klinesWithRelativeTime } = toRelativeTimestamps(
    processedKlines,
    startTimeKey
  );
  processedKlines = klinesWithRelativeTime;

  return { baseTime, data: processedKlines };
}

/**
 * Optimization 6: Ultra-compact CSV without timestamps
 * Removes time column entirely since row order implies time sequence
 * Useful for LLM analysis where exact timestamps don't matter
 */
export function toCompactCSV(
  records: Record<string, unknown>[],
  options: {
    excludeColumns?: string[]; // Columns to exclude (e.g., ['dT', 'T'])
    defaultValuePlaceholder?: string; // How to represent default values
  } = {}
): string {
  const { excludeColumns = ['dT', 'T', 'dT'], defaultValuePlaceholder = '' } = options;

  if (records.length === 0) {
    return '';
  }

  // Filter out excluded columns
  const allKeys = Object.keys(records[0]);
  const keys = allKeys.filter((k) => !excludeColumns.includes(k));

  const csvHeader = keys.join(',');
  const csvRows = records.map((row: Record<string, unknown>) => {
    return keys
      .map((k) => {
        const val = row[k];
        // Use placeholder for default values (0, empty, null)
        if (val === 0 || val === '0' || val === null || val === '') {
          return defaultValuePlaceholder;
        }
        return val;
      })
      .join(',');
  });

  return `${csvHeader}\n${csvRows.join('\n')}`;
}
