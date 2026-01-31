import type { Trader } from '@/db/schema';
import type { Position } from '@/lib/trading/position-types';

/**
 * Build system prompt for micro-decision analysis
 * Provides context about the trader's strategy and preferences
 */
export function buildMicroDecisionSystemPrompt(trader: Trader): string {
  return `You are a cryptocurrency trading analyst specializing in ${trader.tradingStrategy} strategy.

**Trader Profile:**
- Name: ${trader.name}
- Strategy: ${trader.tradingStrategy}
- Aggressiveness: ${trader.aggressivenessLevel}/10
- Risk Preference: ${trader.riskPreferenceScore}/10
- Holding Period: ${trader.holdingPeriod}
- Position Stop Loss: ${trader.positionStopLoss}%
- Position Take Profit: ${trader.positionTakeProfit}%
- Leverage Range: ${trader.minLeverage}x to ${trader.maxLeverage}x
- Min Trade Amount: $${trader.minTradeAmount}
- Max Position Size: $${trader.maxPositionSize}

**Decision Guidelines:**
- Confidence 0.7+ = STRONG SIGNAL - TAKE ACTION (open/close position)
- Confidence 0.5-0.69 = MODERATE SIGNAL - Consider taking small positions or partial action
- Confidence below 0.5 = INSUFFICIENT SIGNALS - HOLD
- IMPORTANT: Being too conservative has opportunity costs. When signals are moderately clear (0.5+), lean towards taking action rather than always holding.
- Use hold only when signals are truly unclear, conflicting, or risk/reward is unfavorable.

Analyze the provided market data for a SINGLE K-line interval and provide a micro-decision.
Return your decision as a structured JSON response.`;
}

/**
 * Build user prompt for micro-decision analysis
 * Includes market data, current positions, and interval information
 */
export function buildMicroDecisionUserPrompt(args: {
  interval: string;
  readerData: Array<{ readerName: string; data: unknown }>;
  currentPositions: Position[];
  tradingPair: string;
}): string {
  const { interval, readerData, currentPositions, tradingPair } = args;

  let prompt = `**Trading Pair:** ${tradingPair}\n`;
  prompt += `**K-line Interval:** ${interval}\n\n`;

  // Position status awareness
  if (currentPositions.length === 0) {
    prompt += `**Position Status:** NO OPEN POSITIONS\n`;
    prompt += `IMPORTANT: The system currently has no market exposure. Lower your action threshold slightly - when confidence is 0.5+, consider taking reasonable positions to enter the market rather than waiting for perfect signals.\n\n`;
  } else {
    prompt += `**Position Status:** ${currentPositions.length} OPEN POSITION(S)\n`;
    prompt += `Focus on both managing existing positions and finding new opportunities.\n\n`;
  }

  if (currentPositions.length > 0) {
    prompt += `**Current Open Positions:**\n`;
    prompt += `| ID | Side | Entry Price | Current Price | PnL % |\n`;
    currentPositions.forEach((pos) => {
      const pnlPercent =
        pos.side === 'long'
          ? ((parseFloat(pos.currentPrice) - parseFloat(pos.entryPrice)) /
              parseFloat(pos.entryPrice)) *
            100
          : ((parseFloat(pos.entryPrice) - parseFloat(pos.currentPrice)) /
              parseFloat(pos.entryPrice)) *
            100;
      prompt += `| ${pos.id} | ${pos.side} | ${pos.entryPrice} | ${pos.currentPrice} | ${pnlPercent.toFixed(2)}% |\n`;
    });
    prompt += `\n`;
  }

  prompt += `**Market Data from Readers:**\n\n`;
  readerData.forEach(({ readerName, data }) => {
    // Check if data has format information
    if (data && typeof data === 'object' && 'fmt' in data) {
      const fmt = (data as { fmt: string }).fmt;
      if (fmt === 'csv') {
        // CSV format - display as-is
        const csvData = (data as { d: string }).d;
        prompt += `### ${readerName} (CSV format)\n\`\`\`\n${csvData}\n\`\`\`\n\n`;
      } else {
        // JSON format
        prompt += `### ${readerName}\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\`\n\n`;
      }
    } else {
      // No format specified, default to JSON
      prompt += `### ${readerName}\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\`\n\n`;
    }
  });

  return prompt;
}

/**
 * Build system prompt for comprehensive decision
 * Provides context for making final trading decision
 */
export function buildComprehensiveDecisionSystemPrompt(trader: Trader): string {
  return `You are a senior cryptocurrency trading strategist making comprehensive trading decisions.

**Trader Profile:**
- Name: ${trader.name}
- Strategy: ${trader.tradingStrategy}
- Aggressiveness: ${trader.aggressivenessLevel}/10
- Max Positions: ${trader.maxPositions}
- Max Position Size: $${trader.maxPositionSize}
- Leverage Range: ${trader.minLeverage}x to ${trader.maxLeverage}x (IMPORTANT: Always stay within this range)
- Min Trade Amount: $${trader.minTradeAmount}

**Decision Guidelines:**
- Confidence 0.7+ = STRONG CONSENSUS - TAKE ACTION with appropriate position size
- Confidence 0.5-0.69 = MODERATE CONFIDENCE - When 2+ intervals agree, consider taking action
- Confidence below 0.5 = INSUFFICIENT CONSENSUS - HOLD
- IMPORTANT: Missing opportunities in trading has a real cost. When multiple timeframes show alignment (even with moderate confidence), lean towards taking calculated positions.
- Weigh longer timeframes (1h+, 4h) more heavily than shorter ones for trend confirmation.
- Look for confluence: when 3+ intervals align in the same direction, that's a strong signal.

Analyze micro-decisions from multiple K-line intervals and make a comprehensive trading decision.
Weigh each interval's decision based on timeframe relevance, confidence scores, and strategy alignment.

Return your comprehensive decision as a structured JSON response.`;
}

/**
 * Build user prompt for comprehensive decision
 * Includes all micro-decisions and current positions
 */
export function buildComprehensiveDecisionUserPrompt(args: {
  microDecisions: Array<{ interval: string; decision: unknown }>;
  currentPositions: Position[];
  tradingPair: string;
}): string {
  const { microDecisions, currentPositions, tradingPair } = args;

  let prompt = `**Trading Pair:** ${tradingPair}\n\n`;

  // Position status awareness
  if (currentPositions.length === 0) {
    prompt += `**Position Status:** NO OPEN POSITIONS\n`;
    prompt += `REMINDER: The system has no market exposure. When micro-decisions show moderate alignment (multiple intervals suggesting the same action with 0.5+ confidence), consider entering the market rather than holding.\n\n`;
  } else {
    prompt += `**Position Status:** ${currentPositions.length} OPEN POSITION(S)\n`;
    prompt += `Balance between managing existing positions and seeking new opportunities.\n\n`;
  }

  prompt += `**Current Open Positions:**\n`;
  if (currentPositions.length > 0) {
    currentPositions.forEach((pos) => {
      prompt += `- Position #${pos.id}: ${pos.side.toUpperCase()} | Entry: $${pos.entryPrice} | Current: $${pos.currentPrice} | SL: $${pos.stopLossPrice || 'N/A'} | TP: $${pos.takeProfitPrice || 'N/A'}\n`;
    });
  } else {
    prompt += `No open positions\n`;
  }
  prompt += `\n`;

  prompt += `**Micro-Decisions by Interval:**\n\n`;
  microDecisions.forEach(({ interval, decision }) => {
    prompt += `### ${interval}\n\`\`\`json\n${JSON.stringify(decision, null, 2)}\n\`\`\`\n\n`;
  });

  return prompt;
}
