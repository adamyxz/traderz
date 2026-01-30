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
    prompt += `### ${readerName}\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\`\n\n`;
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
