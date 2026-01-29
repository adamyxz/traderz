/**
 * React hook for testing DeepSeek API connectivity
 */

import { useState, useCallback } from 'react';

export interface TestResult {
  success: boolean;
  timestamp: number;
  duration: number;
  response?: {
    length: number;
    preview: string;
  };
  error?: string;
  message: string;
}

export interface UseDeepSeekTestResult {
  testConnection: (prompt?: string) => Promise<TestResult>;
  isTesting: boolean;
  lastResult: TestResult | null;
  error: string | null;
}

export function useDeepSeekTest(): UseDeepSeekTestResult {
  const [isTesting, setIsTesting] = useState(false);
  const [lastResult, setLastResult] = useState<TestResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const testConnection = useCallback(async (prompt?: string): Promise<TestResult> => {
    setIsTesting(true);
    setError(null);

    try {
      const response = await fetch('/api/deepseek/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: prompt || 'Hello! This is a connectivity test.',
        }),
      });

      const result: TestResult = await response.json();

      if (!response.ok) {
        throw new Error(result.error || result.message || 'Test failed');
      }

      setLastResult(result);
      setIsTesting(false);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
      setIsTesting(false);

      const errorResult: TestResult = {
        success: false,
        timestamp: Date.now(),
        duration: 0,
        error: errorMessage,
        message: 'Test failed',
      };

      setLastResult(errorResult);
      return errorResult;
    }
  }, []);

  return {
    testConnection,
    isTesting,
    lastResult,
    error,
  };
}
