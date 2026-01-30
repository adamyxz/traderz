import { z } from 'zod';

/**
 * Micro-decision for single K-line interval analysis
 * Each interval produces a micro-decision based on its timeframe data
 */
export const MicroDecisionSchema = z.object({
  interval: z.string(),
  action: z.enum(['open_long', 'open_short', 'hold', 'close_long', 'close_short', 'modify_sl_tp']),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe(
      'Confidence level from 0 to 1. Use this scale: 0.9-1.0 = very strong signal with multiple confirmations, 0.7-0.89 = good signal with clear indicators, 0.5-0.69 = moderate signal with some uncertainty, 0.3-0.49 = weak signal with mixed indicators, 0.0-0.29 = very weak or conflicting signals. Be honest about uncertainty - if signals are unclear, use a lower score.'
    ),
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
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe(
      'Overall confidence level from 0 to 1 for the comprehensive decision. Use this scale: 0.9-1.0 = very strong consensus across intervals with clear risk/reward, 0.7-0.89 = good agreement between timeframes with solid rationale, 0.5-0.69 = moderate confidence with some conflicting signals, 0.3-0.49 = low confidence with significant disagreements, 0.0-0.29 = very weak or unclear signals. Weight the confidence based on alignment between micro-decisions and clarity of the overall setup.'
    ),
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
