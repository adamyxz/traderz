import { Reader, ReaderInput, ReaderOutput, ReaderContext } from './types';
import { executeReaderSafely } from './sandbox';

export async function executeReader(args: {
  reader: Reader;
  input: ReaderInput;
  context: ReaderContext;
}): Promise<ReaderOutput> {
  const { reader, input, context } = args;

  try {
    // 构建完整的脚本路径
    const scriptFullPath = `/Users/yxz/dev/traderz/${reader.scriptPath}`;

    // 使用沙箱执行
    const result = await executeReaderSafely({
      readerPath: scriptFullPath,
      input,
      context,
      timeout: reader.timeout || 30000,
    });

    return result;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Execution failed',
    };
  }
}
