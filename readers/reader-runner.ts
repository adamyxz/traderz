#!/usr/bin/env tsx
/**
 * Reader Runner
 * This script executes a reader module with the given input and context.
 * It's designed to be spawned as a child process for isolated execution.
 */

interface ReaderInput {
  [key: string]: unknown;
}

interface ReaderContext {
  readerId: string;
  requestId: string;
  triggeredBy: string;
  timestamp: string;
  environment: 'development' | 'production';
}

interface ReaderOutput<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: {
    executionTime: number;
    timestamp: string;
    version: string;
  };
}

// Get arguments from command line
const args = process.argv.slice(2);
if (args.length < 2) {
  console.error(JSON.stringify({ success: false, error: 'Missing arguments' }));
  process.exit(1);
}

const readerPath = args[0];
const inputDataStr = args[1];

try {
  const inputData = JSON.parse(inputDataStr) as { input: ReaderInput; context: ReaderContext };

  // Import the reader module
  // Use require to avoid webpack dynamic import issues
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const readerModule = require(readerPath);
  const executeFn = readerModule.execute || readerModule.default?.execute;

  if (!executeFn || typeof executeFn !== 'function') {
    console.error(JSON.stringify({ success: false, error: 'Reader must export execute function' }));
    process.exit(1);
  }

  executeFn(inputData.input, inputData.context)
    .then((result: ReaderOutput) => {
      console.log('__OUTPUT_START__');
      console.log(JSON.stringify(result));
      console.log('__OUTPUT_END__');
    })
    .catch((error: Error) => {
      console.error('__OUTPUT_START__');
      console.error(JSON.stringify({ success: false, error: error.message }));
      console.error('__OUTPUT_END__');
      process.exit(1);
    });
} catch (error) {
  console.error(
    JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to parse input',
    })
  );
  process.exit(1);
}
