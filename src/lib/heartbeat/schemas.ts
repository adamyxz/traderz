import { z } from 'zod';

/**
 * Micro-decision for single K-line interval analysis
 * Each interval produces a micro-decision based on its timeframe data
 */
export const MicroDecisionSchema = z.object({
  interval: z.string(),
  action: z.enum(['open_long', 'open_short', 'hold', 'close_long', 'close_short', 'modify_sl_tp']),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
  technicalSignals: z.object({
    trend: z.enum(['bullish', 'bearish', 'neutral']),
    momentum: z.enum(['strong', 'moderate', 'weak']),
    volumeAnalysis: z.string(),
    keyLevels: z.string(),
  }),
  suggestedStopLoss: z.number().optional(),
  suggestedTakeProfit: z.number().optional(),
  targetPositionId: z.number().optional(),
});

export type MicroDecision = z.infer<typeof MicroDecisionSchema>;

/**
 * Comprehensive decision combining all intervals
 * Weighs micro-decisions from different timeframes to make final trading decision
 */
export const ComprehensiveDecisionSchema = z.object({
  action: z.enum([
    'open_long',
    'open_short',
    'hold',
    'close_position',
    'modify_sl_tp',
    'close_all',
  ]),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
  intervalAnalysis: z.array(
    z.object({
      interval: z.string(),
      weight: z.number(),
      decision: z.string(),
      keyFactors: z.string(),
    })
  ),
  positionSize: z.number().optional(),
  leverage: z.number().optional(),
  stopLossPrice: z.number().optional(),
  takeProfitPrice: z.number().optional(),
  targetPositionId: z.number().optional(),
  riskAssessment: z.object({
    level: z.enum(['low', 'medium', 'high', 'very_high']),
    riskRewardRatio: z.number(),
    positionSizePercent: z.number(),
  }),
  timestamp: z.string(),
});

export type ComprehensiveDecision = z.infer<typeof ComprehensiveDecisionSchema>;
