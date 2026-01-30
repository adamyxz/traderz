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
