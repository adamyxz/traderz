/**
 * 定时任务调度器
 * 每10秒更新所有持仓的价格和未实现盈亏
 */

let schedulerInterval: NodeJS.Timeout | null = null;
let isRunning: boolean = false;

/**
 * 启动定时调度器
 * @param callback 每10秒执行的回调函数
 */
export function startScheduler(callback: () => Promise<void>): void {
  if (isRunning) {
    console.log('[Scheduler] Already running');
    return;
  }

  console.log('[Scheduler] Starting position price update scheduler (every 10 seconds)');
  isRunning = true;

  // 立即执行一次
  callback().catch((error) => {
    console.error('[Scheduler] Error in initial execution:', error);
  });

  // 每10秒执行一次
  schedulerInterval = setInterval(async () => {
    try {
      await callback();
    } catch (error) {
      console.error('[Scheduler] Error in scheduled execution:', error);
    }
  }, 10000);
}

/**
 * 停止定时调度器
 */
export function stopScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    isRunning = false;
    console.log('[Scheduler] Stopped');
  }
}

/**
 * 检查调度器是否正在运行
 */
export function isSchedulerRunning(): boolean {
  return isRunning;
}

/**
 * 获取调度器状态
 */
export function getSchedulerStatus(): {
  isRunning: boolean;
  interval: number;
} {
  return {
    isRunning,
    interval: 10000, // 10秒
  };
}

/**
 * 手动触发一次价格更新
 * @param callback 回调函数
 */
export async function triggerUpdate(callback: () => Promise<void>): Promise<void> {
  console.log('[Scheduler] Manual update triggered');
  await callback();
}
