import { watch } from 'fs/promises';
import { syncReadersFromDirectory } from './sync';
import { db } from '@/db';

let ac: AbortController | null = null;

export async function startWatchingReaders(args: {
  readersDirectory: string;
  onSync?: (result: {
    synced: number;
    created: number;
    updated: number;
    skipped: number;
    errors: string[];
  }) => void;
}) {
  const { readersDirectory, onSync } = args;

  if (ac) {
    console.log('Reader watcher already running');
    return;
  }

  ac = new AbortController();
  const { signal } = ac;

  console.log(`Watching readers directory: ${readersDirectory}`);

  try {
    const watcher = watch(readersDirectory, { recursive: true, signal });

    for await (const event of watcher) {
      console.log(`Reader file changed: ${event.filename}`);

      // 防抖处理 - 等待1秒后再同步
      await new Promise((resolve) => setTimeout(resolve, 1000));

      try {
        const result = await syncReadersFromDirectory({
          readersDirectory,
          db,
        });

        console.log('Readers synced:', result);

        if (onSync) {
          onSync(result);
        }
      } catch (error) {
        console.error('Failed to sync readers:', error);
      }
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.log('Reader watcher stopped');
    } else {
      console.error('Reader watcher error:', error);
    }
  }
}

export function stopWatchingReaders() {
  if (ac) {
    ac.abort();
    ac = null;
    console.log('Reader watcher stopped');
  }
}

// 开发环境自动启动
if (process.env.NODE_ENV === 'development') {
  startWatchingReaders({
    readersDirectory: '/Users/yxz/dev/traderz/readers',
  }).catch(console.error);
}
