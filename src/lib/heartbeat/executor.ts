import { db } from '@/db';
import {
  klineIntervals,
  traderKlineIntervals,
  readers,
  traderReaders,
  readerParameters,
  positions,
  heartbeatHistory,
  tradingPairs,
} from '@/db/schema';
import { eq, inArray, and } from 'drizzle-orm';
import { DeepSeekChatClient } from '@/lib/deepseek/chat';
import { MicroDecisionSchema, ComprehensiveDecisionSchema } from './schemas';
import {
  buildMicroDecisionSystemPrompt,
  buildMicroDecisionUserPrompt,
  buildComprehensiveDecisionSystemPrompt,
  buildComprehensiveDecisionUserPrompt,
} from './prompts';
import { executeReader } from '@/lib/readers/executor';
import type { ReaderContext } from '@/lib/readers/types';
import type { Trader } from '@/db/schema';
import type { Position } from '@/lib/trading/position-types';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

/**
 * Check if current time is within trader's active hours
 */
function isWithinActiveHours(trader: Trader): boolean {
  const now = new Date();
  const currentTimeInMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();

  const [startHours, startMinutes] = trader.activeTimeStart.split(':').map(Number);
  const [endHours, endMinutes] = trader.activeTimeEnd.split(':').map(Number);
  const startTimeInMinutes = startHours * 60 + startMinutes;
  const endTimeInMinutes = endHours * 60 + endMinutes;

  // Handle overnight time ranges (e.g., 22:00 to 06:00)
  if (endTimeInMinutes < startTimeInMinutes) {
    return currentTimeInMinutes >= startTimeInMinutes || currentTimeInMinutes < endTimeInMinutes;
  }
  return currentTimeInMinutes >= startTimeInMinutes && currentTimeInMinutes < endTimeInMinutes;
}

/**
 * Load reader metadata from file system
 * Metadata is stored in readers/{readerName}/metadata.json
 */
async function loadReaderMetadata(
  readerName: string
): Promise<{ standardParameters?: Record<string, string> } | undefined> {
  try {
    const readersDir = '/Users/yxz/dev/traderz/readers';
    const metadataPath = join(readersDir, readerName, 'metadata.json');

    if (!existsSync(metadataPath)) {
      console.warn(`[Heartbeat] Metadata file not found for reader: ${readerName}`);
      return undefined;
    }

    const metadataContent = await readFile(metadataPath, 'utf-8');
    const metadata = JSON.parse(metadataContent);
    return metadata;
  } catch (error) {
    console.error(`[Heartbeat] Failed to load metadata for ${readerName}:`, error);
    return undefined;
  }
}

/**
 * Execute heartbeat for a trader
 * Loops through all K-line intervals, gathers data via readers, gets LLM decisions, and executes
 */
export async function executeHeartbeat(trader: Trader) {
  const startTime = Date.now();

  // Create heartbeat record
  const [heartbeatRecord] = await db
    .insert(heartbeatHistory)
    .values({
      traderId: trader.id,
      status: 'in_progress',
      triggeredAt: new Date(),
      startedAt: new Date(),
      wasWithinActiveHours: isWithinActiveHours(trader),
    })
    .returning();

  try {
    // 1. Validate active time
    if (!isWithinActiveHours(trader)) {
      const [updated] = await db
        .update(heartbeatHistory)
        .set({
          status: 'skipped_outside_hours',
          completedAt: new Date(),
          duration: Date.now() - startTime,
        })
        .where(eq(heartbeatHistory.id, heartbeatRecord.id))
        .returning();
      return updated;
    }

    // 2. Get K-line intervals
    const intervalRelations = await db
      .select()
      .from(traderKlineIntervals)
      .where(eq(traderKlineIntervals.traderId, trader.id));

    if (intervalRelations.length === 0) {
      const [updated] = await db
        .update(heartbeatHistory)
        .set({
          status: 'skipped_no_intervals',
          completedAt: new Date(),
          duration: Date.now() - startTime,
        })
        .where(eq(heartbeatHistory.id, heartbeatRecord.id))
        .returning();
      return updated;
    }

    const traderIntervals = await db
      .select()
      .from(klineIntervals)
      .where(
        inArray(
          klineIntervals.id,
          intervalRelations.map((r) => r.klineIntervalId)
        )
      );

    // 3. Get readers - include both trader-associated readers AND mandatory readers
    const readerRelations = await db
      .select()
      .from(traderReaders)
      .where(eq(traderReaders.traderId, trader.id));

    // Get all mandatory readers (regardless of trader association)
    const mandatoryReaders = await db.select().from(readers).where(eq(readers.mandatory, true));

    // Get trader-associated reader IDs
    const traderReaderIds = readerRelations.map((r) => r.readerId);
    const mandatoryReaderIds = mandatoryReaders.map((r) => r.id);

    // Combine trader readers with mandatory readers (avoiding duplicates)
    const allReaderIds = Array.from(new Set([...traderReaderIds, ...mandatoryReaderIds]));

    if (allReaderIds.length === 0) {
      const [updated] = await db
        .update(heartbeatHistory)
        .set({
          status: 'skipped_no_readers',
          completedAt: new Date(),
          duration: Date.now() - startTime,
        })
        .where(eq(heartbeatHistory.id, heartbeatRecord.id))
        .returning();
      return updated;
    }

    const traderReadersList = await db
      .select()
      .from(readers)
      .where(inArray(readers.id, allReaderIds));

    // Load metadata for all readers from file system
    const readerMetadataMap = new Map<number, { standardParameters?: Record<string, string> }>();
    for (const reader of traderReadersList) {
      const metadata = await loadReaderMetadata(reader.name);
      if (metadata) {
        readerMetadataMap.set(reader.id, metadata);
      }
    }

    // Get all reader parameters with their default values
    const allReaderParams = await db
      .select()
      .from(readerParameters)
      .where(
        inArray(
          readerParameters.readerId,
          traderReadersList.map((r) => r.id)
        )
      );

    // Group parameters by readerId for easy lookup
    const paramsByReaderId: Record<number, typeof allReaderParams> = {};
    for (const param of allReaderParams) {
      if (!paramsByReaderId[param.readerId]) {
        paramsByReaderId[param.readerId] = [];
      }
      paramsByReaderId[param.readerId].push(param);
    }

    // 4. Get current positions
    const currentPositions = await db
      .select()
      .from(positions)
      .where(and(eq(positions.traderId, trader.id), eq(positions.status, 'open')));

    // 5. Get trading pair symbol
    let tradingPairSymbol = 'BTCUSDT';
    let tradingPairId: number | undefined;
    if (trader.preferredTradingPairId) {
      const [pair] = await db
        .select()
        .from(tradingPairs)
        .where(eq(tradingPairs.id, trader.preferredTradingPairId))
        .limit(1);
      if (pair) {
        tradingPairSymbol = pair.symbol;
        tradingPairId = pair.id;
      }
    }

    // 6. Execute micro-decisions for each interval
    const microDecisions: Array<{ interval: string; decision: unknown }> = [];
    const readersExecuted: Array<{ readerId: number; success: boolean; executionTime: number }> =
      [];

    for (const interval of traderIntervals) {
      const readerData: Array<{ readerName: string; data: unknown }> = [];

      for (const reader of traderReadersList) {
        const readerStartTime = Date.now();
        try {
          const context: ReaderContext = {
            readerId: reader.id.toString(),
            requestId: `heartbeat-${heartbeatRecord.id}`,
            triggeredBy: 'heartbeat-system',
            timestamp: new Date().toISOString(),
            environment: (process.env.NODE_ENV as 'development' | 'production') || 'development',
          };

          // Build input with default values applied
          const readerParams = paramsByReaderId[reader.id] || [];
          const inputWithDefaults: Record<string, unknown> = {};

          // Inject standard parameters based on metadata declaration
          // Note: metadata is loaded from file system, stored in readerMetadataMap
          const metadata = readerMetadataMap.get(reader.id);
          const standardParams = metadata?.standardParameters || {};

          // Map standard parameters to reader's expected parameter names
          for (const [standardType, targetParam] of Object.entries(standardParams)) {
            if (standardType === 'symbol') {
              inputWithDefaults[targetParam] = tradingPairSymbol;
            } else if (standardType === 'interval') {
              inputWithDefaults[targetParam] = interval.code;
            }
          }

          // Apply default values for parameters that have them
          // Only apply defaults if the parameter is not already set
          for (const paramDef of readerParams) {
            const paramKey = paramDef.paramName;
            // Skip if parameter already has a value (e.g., from standard parameters)
            if (inputWithDefaults[paramKey] !== undefined) {
              continue;
            }
            if (paramDef.defaultValue !== null && paramDef.defaultValue !== undefined) {
              try {
                inputWithDefaults[paramKey] = JSON.parse(paramDef.defaultValue);
              } catch {
                inputWithDefaults[paramKey] = paramDef.defaultValue;
              }
            }
          }

          const result = await executeReader({
            reader: {
              ...reader,
              timeout: reader.timeout || 30000, // Handle null timeout by using default
            },
            input: inputWithDefaults,
            context,
          });

          readersExecuted.push({
            readerId: reader.id,
            success: result.success,
            executionTime: Date.now() - readerStartTime,
          });
          if (result.success && result.data) {
            readerData.push({ readerName: reader.name, data: result.data });
          }
        } catch (error) {
          console.error(`[Heartbeat] Reader ${reader.name} failed:`, error);
          readersExecuted.push({
            readerId: reader.id,
            success: false,
            executionTime: Date.now() - readerStartTime,
          });
        }
      }

      // Get micro-decision from LLM
      const llmClient = new DeepSeekChatClient({ temperature: 0.6, maxTokens: 1000 });
      const structuredRunner = llmClient.withStructuredOutput(MicroDecisionSchema);
      const systemPrompt = buildMicroDecisionSystemPrompt(trader);
      const userPrompt = buildMicroDecisionUserPrompt({
        interval: interval.code,
        readerData,
        currentPositions: currentPositions as Position[],
        tradingPair: tradingPairSymbol,
      });

      const microDecision = await structuredRunner.invokeWithOptions(userPrompt, systemPrompt, {
        callType: 'chat',
        metadata: {
          source: 'heartbeat-micro-decision',
          heartbeatId: heartbeatRecord.id,
          traderId: trader.id,
          traderName: trader.name,
          interval: interval.code,
          readerCount: readerData.length,
        },
      });

      microDecisions.push({ interval: interval.code, decision: microDecision });
    }

    // 7. Get comprehensive decision
    const comprehensiveClient = new DeepSeekChatClient({ temperature: 0.5, maxTokens: 1500 });
    const comprehensiveRunner = comprehensiveClient.withStructuredOutput(
      ComprehensiveDecisionSchema
    );
    const compSystemPrompt = buildComprehensiveDecisionSystemPrompt(trader);
    const compUserPrompt = buildComprehensiveDecisionUserPrompt({
      microDecisions,
      currentPositions: currentPositions as Position[],
      tradingPair: tradingPairSymbol,
    });

    const finalDecision = await comprehensiveRunner.invokeWithOptions(
      compUserPrompt,
      compSystemPrompt,
      {
        callType: 'chat',
        metadata: {
          source: 'heartbeat-comprehensive-decision',
          heartbeatId: heartbeatRecord.id,
          traderId: trader.id,
          traderName: trader.name,
          intervalCount: microDecisions.length,
        },
      }
    );

    // 8. Execute decision
    const executionResult = await executeDecision({
      trader,
      decision: finalDecision,
      tradingPairSymbol,
      tradingPairId,
      currentPositions: currentPositions as Position[],
    });

    // 9. Update heartbeat record
    const [updated] = await db
      .update(heartbeatHistory)
      .set({
        status: executionResult.success ? 'completed' : 'failed',
        completedAt: new Date(),
        duration: Date.now() - startTime,
        microDecisions: JSON.stringify(microDecisions),
        finalDecision: JSON.stringify(finalDecision),
        executionAction: executionResult.action,
        executionResult: JSON.stringify(executionResult),
        readersExecuted: JSON.stringify(readersExecuted),
        errorMessage: executionResult.error,
      })
      .where(eq(heartbeatHistory.id, heartbeatRecord.id))
      .returning();

    return updated;
  } catch (error) {
    console.error(`[Heartbeat] Error:`, error);
    const [updated] = await db
      .update(heartbeatHistory)
      .set({
        status: 'failed',
        completedAt: new Date(),
        duration: Date.now() - startTime,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      })
      .where(eq(heartbeatHistory.id, heartbeatRecord.id))
      .returning();
    return updated;
  }
}

/**
 * Execute the comprehensive trading decision
 */
async function executeDecision(args: {
  trader: Trader;
  decision: unknown;
  tradingPairSymbol: string;
  tradingPairId?: number;
  currentPositions: Position[];
}): Promise<{
  success: boolean;
  action: string;
  positionId?: number;
  message?: string;
  error?: string;
}> {
  const { trader, decision, tradingPairSymbol, tradingPairId, currentPositions } = args;

  if (!decision || typeof decision !== 'object') {
    return { success: false, action: 'none', error: 'Invalid decision format' };
  }

  const dec = decision as {
    action: string;
    leverage?: number;
    positionSize?: number;
    stopLossPrice?: number;
    takeProfitPrice?: number;
    targetPositionId?: number;
  };

  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    switch (dec.action) {
      case 'open_long':
      case 'open_short': {
        // Find trading pair ID if not provided
        let pairId = tradingPairId;
        if (!pairId) {
          const [pair] = await db
            .select()
            .from(tradingPairs)
            .where(eq(tradingPairs.symbol, tradingPairSymbol))
            .limit(1);
          if (!pair)
            return {
              success: false,
              action: dec.action,
              error: `Trading pair ${tradingPairSymbol} not found`,
            };
          pairId = pair.id;
        }

        const side = dec.action === 'open_long' ? 'long' : 'short';

        // Calculate leverage with validation against trader limits
        const minLev = parseFloat(trader.minLeverage);
        const maxLev = parseFloat(trader.maxLeverage);
        let leverage = dec.leverage || maxLev * 0.5;

        // Clamp leverage to within trader's limits
        if (leverage < minLev) {
          console.warn(
            `[Executor] Suggested leverage ${leverage} is below min ${minLev}, clamping to min`
          );
          leverage = minLev;
        } else if (leverage > maxLev) {
          console.warn(
            `[Executor] Suggested leverage ${leverage} is above max ${maxLev}, clamping to max`
          );
          leverage = maxLev;
        }

        const positionSize = dec.positionSize || parseFloat(trader.minTradeAmount);

        const response = await fetch(`${baseUrl}/api/positions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            traderId: trader.id,
            tradingPairId: pairId,
            side,
            leverage,
            positionSize,
            stopLossPrice: dec.stopLossPrice,
            takeProfitPrice: dec.takeProfitPrice,
          }),
        });

        const result = await response.json();
        return result.success
          ? {
              success: true,
              action: dec.action,
              positionId: result.data.id,
              message: `Opened ${side} position`,
            }
          : { success: false, action: dec.action, error: result.error };
      }

      case 'close_position':
      case 'close_all': {
        const positionId = dec.targetPositionId || currentPositions[0]?.id;
        if (!positionId)
          return { success: false, action: dec.action, error: 'No position to close' };

        const response = await fetch(`${baseUrl}/api/positions/${positionId}/close`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        const result = await response.json();
        return result.success
          ? { success: true, action: dec.action, positionId, message: 'Closed position' }
          : { success: false, action: dec.action, error: result.error };
      }

      case 'modify_sl_tp': {
        const positionId = dec.targetPositionId;
        if (!positionId)
          return { success: false, action: dec.action, error: 'No target position specified' };

        const response = await fetch(`${baseUrl}/api/positions/${positionId}/modify`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            stopLossPrice: dec.stopLossPrice,
            takeProfitPrice: dec.takeProfitPrice,
          }),
        });
        const result = await response.json();
        return result.success
          ? {
              success: true,
              action: dec.action,
              positionId,
              message: 'Modified stop-loss/take-profit',
            }
          : { success: false, action: dec.action, error: result.error };
      }

      case 'hold':
        return { success: true, action: 'none', message: 'No action taken' };

      default:
        return { success: false, action: 'none', error: `Unknown action: ${dec.action}` };
    }
  } catch (error) {
    return {
      success: false,
      action: dec.action || 'none',
      error: error instanceof Error ? error.message : 'Execution failed',
    };
  }
}
