import { ReaderInput, ReaderOutput, ReaderContext } from './types';
import { spawn } from 'child_process';
import * as path from 'path';

export async function executeReaderSafely(args: {
  readerPath: string;
  input: ReaderInput;
  context: ReaderContext;
  timeout: number;
}): Promise<ReaderOutput> {
  const { readerPath, input, context, timeout } = args;

  return new Promise((resolve) => {
    const absolutePath = path.isAbsolute(readerPath)
      ? readerPath
      : path.resolve(process.cwd(), readerPath);

    // Path to the runner script
    const runnerPath = path.resolve(process.cwd(), 'readers/reader-runner.ts');

    // Prepare input data
    const inputData = JSON.stringify({ input, context });

    let output = '';
    let errorOutput = '';
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      resolve({
        success: false,
        error: 'Execution timeout',
      });
    }, timeout);

    try {
      // Use tsx to run the TypeScript runner script
      const child = spawn('npx', ['tsx', runnerPath, absolutePath, inputData], {
        stdio: ['ignore', 'pipe', 'pipe'],
        cwd: process.cwd(),
        env: {
          ...process.env,
          NODE_PATH: path.resolve(process.cwd(), 'src'),
        },
      });

      child.stdout.on('data', (data) => {
        output += data.toString();
      });

      child.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      child.on('close', (_code) => {
        clearTimeout(timer);

        if (timedOut) return;

        try {
          // Extract output between markers
          const startMarker = '__OUTPUT_START__';
          const endMarker = '__OUTPUT_END__';

          const startIndex = output.indexOf(startMarker);
          const endIndex = output.indexOf(endMarker);

          if (startIndex !== -1 && endIndex !== -1) {
            const jsonOutput = output.substring(startIndex + startMarker.length, endIndex).trim();

            resolve(JSON.parse(jsonOutput));
          } else {
            // Fallback: try parsing entire output
            if (output.trim()) {
              try {
                resolve(JSON.parse(output.trim()));
              } catch {
                resolve({
                  success: false,
                  error: 'Failed to parse output',
                  rawOutput: output,
                  stderr: errorOutput,
                });
              }
            } else {
              resolve({
                success: false,
                error: errorOutput || 'No output received',
              });
            }
          }
        } catch (error) {
          resolve({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to execute reader',
            details: output,
            stderr: errorOutput,
          });
        }
      });

      child.on('error', (err) => {
        clearTimeout(timer);
        if (timedOut) return;

        resolve({
          success: false,
          error: `Failed to start execution: ${err.message}`,
        });
      });
    } catch (error) {
      clearTimeout(timer);
      if (timedOut) return;

      resolve({
        success: false,
        error: error instanceof Error ? error.message : 'Execution failed',
      });
    }
  });
}
