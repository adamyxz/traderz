import type {
  OptimizationContext,
  PerformanceMetrics,
  PositionData,
  TraderContext,
  KlineData,
} from './schemas';

/**
 * Build the system prompt for trader optimization
 */
export function buildOptimizationSystemPrompt(): string {
  return `You are an expert quantitative trading analyst and AI trading bot optimizer specializing in cryptocurrency futures trading.

Your task is to analyze a trader's historical performance and suggest parameter optimizations to improve future results.

# Your Expertise

1. **Risk Management**: You understand the critical importance of position sizing, stop-loss levels, and drawdown control
2. **Market Dynamics**: You recognize different market conditions (trending, ranging, volatile) and how strategies should adapt
3. **Strategy Alignment**: You ensure trading parameters align with the stated trading strategy (trend, oscillation, scalping, etc.)
4. **Statistical Analysis**: You interpret win rates, profit factors, and consecutive loss patterns correctly
5. **Psychology**: You understand that over-optimization and over-reacting to small samples leads to poor performance

# Your Approach

1. **Data-Driven**: Base all recommendations on the provided performance metrics and position history
2. **Conservative**: When in doubt, make smaller adjustments. Radical changes often backfire
3. **Holistic**: Consider how parameters interact (e.g., leverage + position size + stop loss)
4. **Market-Aware**: Factor in the provided K-line data to understand recent market conditions
5. **Explainable**: Always explain the reasoning behind each suggestion

# Key Guidelines

- **Minimum 5 closed positions** required for meaningful optimization. With fewer, be very conservative.
- **Win rate vs risk-adjusted returns**: A 40% win rate can be profitable if wins are 2x larger than losses
- **Drawdown is critical**: If max drawdown exceeds threshold, reduce risk immediately
- **Consecutive losses**: More than 3-4 consecutive losses suggests the strategy may be unsuited for current market
- **Leverage**: Only increase leverage if: (1) win rate > 50%, (2) profit factor > 1.5, (3) max drawdown < threshold
- **Stop loss/take profit**: Adjust based on volatility. Tight stops in volatile markets = premature exits
- **Position sizing**: Reduce position size after losses, can increase gradually after consistent wins
- **Trading hours**: If most losses occur in specific hours, suggest narrowing active hours
- **Strategy fit**: If performance contradicts strategy (e.g., trend trader losing in trending market), suggest strategy change

# Trading Strategies Reference

- **trend**: Follows directional momentum, uses wider stops, rides winners
- **oscillation**: Mean-reversion, tighter stops, takes profits at resistance/support
- **scalping**: High frequency, small profits, very tight risk management
- **swing**: Medium-term holds, wider stops, larger position sizes
- **arbitrage**: Low risk, seeks price discrepancies, low leverage
- **market_making**: Provides liquidity, tight spreads, low risk per trade

# Output Format

Provide your suggestions as a JSON object with only the fields that should be changed. Include a "reasoning" field with your detailed analysis.

Example:
\`\`\`json
{
  "maxLeverage": 10,
  "positionStopLoss": 3.5,
  "riskPreferenceScore": 6,
  "reasoning": "Win rate of 65% with profit factor of 1.8 indicates good edge. However, max drawdown of 15.2% exceeds the 10% threshold, suggesting position sizing is too aggressive. Reducing leverage from 15x to 10x and tightening stop loss from 5% to 3.5% should control drawdown while preserving profitability. Risk preference lowered from 7 to 6 to reflect more conservative approach."
}
\`\`\`

# What NOT to Do

- Don't suggest changes based on < 5 positions
- Don't change strategy unless clearly misaligned with market conditions
- Don't increase leverage after consecutive losses
- Don't remove stop losses entirely
- Don't optimize every parameter at once - focus on what matters most
- Don't ignore the trader's established risk tolerance without justification`;
}

/**
 * Calculate performance metrics from positions
 */
function calculatePerformanceMetrics(positions: PositionData[]): PerformanceMetrics {
  const closedPositions = positions.filter((p) => p.status === 'closed');
  const openPositions = positions.filter((p) => p.status === 'open');
  const liquidatedPositions = positions.filter((p) => p.status === 'liquidated');

  const wins = closedPositions.filter((p) => p.realizedPnl > 0);
  const losses = closedPositions.filter((p) => p.realizedPnl <= 0);

  const totalPnl = closedPositions.reduce((sum, p) => sum + p.realizedPnl, 0);
  const totalPositionSize = closedPositions.reduce((sum, p) => sum + p.positionSize, 0);
  const totalReturnRate = totalPositionSize > 0 ? (totalPnl / totalPositionSize) * 100 : 0;

  const winRate = closedPositions.length > 0 ? (wins.length / closedPositions.length) * 100 : 0;

  const avgWinAmount =
    wins.length > 0 ? wins.reduce((sum, p) => sum + p.realizedPnl, 0) / wins.length : 0;

  const avgLossAmount =
    losses.length > 0 ? losses.reduce((sum, p) => sum + p.realizedPnl, 0) / losses.length : 0;

  const largestWin = wins.length > 0 ? Math.max(...wins.map((p) => p.realizedPnl)) : 0;

  const largestLoss = losses.length > 0 ? Math.min(...losses.map((p) => p.realizedPnl)) : 0;

  // Calculate average holding period
  const holdingPeriods = closedPositions
    .filter((p) => p.openedAt && p.closedAt)
    .map((p) => {
      const opened = new Date(p.openedAt).getTime();
      const closed = new Date(p.closedAt!).getTime();
      return (closed - opened) / (1000 * 60 * 60); // hours
    });

  const avgHoldingPeriodHours =
    holdingPeriods.length > 0
      ? holdingPeriods.reduce((sum, h) => sum + h, 0) / holdingPeriods.length
      : 0;

  // Calculate max drawdown (simplified - using realized PnL)
  let maxDrawdown = 0;
  let peak = 0;
  let cumulativePnl = 0;

  const sortedPositions = [...closedPositions].sort(
    (a, b) => new Date(a.closedAt!).getTime() - new Date(b.closedAt!).getTime()
  );

  for (const pos of sortedPositions) {
    cumulativePnl += pos.realizedPnl;
    if (cumulativePnl > peak) {
      peak = cumulativePnl;
    }
    const drawdown = peak > 0 ? ((peak - cumulativePnl) / peak) * 100 : 0;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
  }

  // Calculate max consecutive losses
  let maxConsecutiveLosses = 0;
  let currentConsecutiveLosses = 0;

  for (const pos of sortedPositions) {
    if (pos.realizedPnl <= 0) {
      currentConsecutiveLosses++;
      maxConsecutiveLosses = Math.max(maxConsecutiveLosses, currentConsecutiveLosses);
    } else {
      currentConsecutiveLosses = 0;
    }
  }

  // Calculate profit factor
  const grossWins = wins.reduce((sum, p) => sum + p.realizedPnl, 0);
  const grossLosses = Math.abs(losses.reduce((sum, p) => sum + p.realizedPnl, 0));
  const profitFactor = grossLosses > 0 ? grossWins / grossLosses : grossWins > 0 ? Infinity : 0;

  // Calculate Sharpe ratio (simplified, assumes 0% risk-free rate)
  const returns = closedPositions.map((p) => (p.realizedPnl / p.positionSize) * 100);
  const avgReturn =
    returns.length > 0 ? returns.reduce((sum, r) => sum + r, 0) / returns.length : 0;

  const variance =
    returns.length > 0
      ? returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length
      : 0;

  const sharpeRatio = variance > 0 ? avgReturn / Math.sqrt(variance) : null;

  // Long vs Short analysis
  const longPositions = positions.filter((p) => p.side === 'long');
  const shortPositions = positions.filter((p) => p.side === 'short');

  const closedLongs = longPositions.filter((p) => p.status === 'closed');
  const closedShorts = shortPositions.filter((p) => p.status === 'closed');

  const longWins = closedLongs.filter((p) => p.realizedPnl > 0);
  const shortWins = closedShorts.filter((p) => p.realizedPnl > 0);

  const longWinRate = closedLongs.length > 0 ? (longWins.length / closedLongs.length) * 100 : 0;
  const shortWinRate = closedShorts.length > 0 ? (shortWins.length / closedShorts.length) * 100 : 0;

  return {
    totalPositions: positions.length,
    openPositions: openPositions.length,
    closedPositions: closedPositions.length,
    liquidatedPositions: liquidatedPositions.length,
    winRate,
    totalPnl,
    totalReturnRate,
    avgWinAmount,
    avgLossAmount,
    largestWin,
    largestLoss,
    avgHoldingPeriodHours,
    maxDrawdown,
    maxConsecutiveLosses,
    profitFactor: profitFactor === Infinity ? 999 : profitFactor,
    sharpeRatio,
    longPositions: longPositions.length,
    shortPositions: shortPositions.length,
    longWinRate,
    shortWinRate,
  };
}

/**
 * Build the user prompt for trader optimization
 */
export function buildOptimizationUserPrompt(context: OptimizationContext): string {
  const { trader, performance, recentPositions, marketData, periodStart, periodEnd } = context;

  // Format the period
  const formatDate = (date: Date) => date.toISOString().split('T')[0];
  const periodStr = `${formatDate(new Date(periodStart))} to ${formatDate(new Date(periodEnd))}`;

  let prompt = `# Trader Optimization Request

Please analyze the following trading data and suggest parameter optimizations to improve performance.

## Analysis Period
**${periodStr}**

## Trader Configuration

**Name**: ${trader.name}
**Description**: ${trader.description || 'None'}
**Status**: ${trader.status}

### Trading Parameters
- **Aggressiveness**: ${trader.aggressivenessLevel}/10
- **Leverage Range**: ${trader.minLeverage}x - ${trader.maxLeverage}x
- **Max Positions**: ${trader.maxPositions}
- **Max Position Size**: $${trader.maxPositionSize.toFixed(2)}
- **Min Trade Amount**: $${trader.minTradeAmount.toFixed(2)}
- **Position Strategy**: ${trader.positionStrategy}
- **Allow Short**: ${trader.allowShort ? 'Yes' : 'No'}

### Risk Control
- **Max Drawdown Limit**: ${trader.maxDrawdown}%
- **Stop Loss Threshold**: ${trader.stopLossThreshold}%
- **Position Stop Loss**: ${trader.positionStopLoss}%
- **Position Take Profit**: ${trader.positionTakeProfit}%
- **Max Consecutive Losses**: ${trader.maxConsecutiveLosses}
- **Daily Max Loss**: $${trader.dailyMaxLoss.toFixed(2)}
- **Risk Preference Score**: ${trader.riskPreferenceScore}/10

### Trading Behavior
- **Heartbeat Interval**: ${trader.heartbeatInterval}s
- **Active Hours**: ${trader.activeTimeStart} - ${trader.activeTimeEnd} UTC
- **Trading Strategy**: ${trader.tradingStrategy}
- **Holding Period**: ${trader.holdingPeriod}

### Preferences
- **Preferred Trading Pair**: ${trader.preferredTradingPairSymbol || 'None'}
- **Created**: ${formatDate(new Date(trader.createdAt))}
- **Last Optimized**: ${trader.lastOptimizedAt ? formatDate(new Date(trader.lastOptimizedAt)) : 'Never'}`;

  // Add performance section
  prompt += `

## Performance Metrics

### Overall Statistics
- **Total Positions**: ${performance.totalPositions}
- **Open Positions**: ${performance.openPositions}
- **Closed Positions**: ${performance.closedPositions}
- **Liquidated Positions**: ${performance.liquidatedPositions}

### Win/Loss Analysis
- **Win Rate**: ${performance.winRate.toFixed(1)}%
- **Total P&L**: $${performance.totalPnl.toFixed(2)}
- **Total Return Rate**: ${performance.totalReturnRate.toFixed(2)}%
- **Average Win**: $${performance.avgWinAmount.toFixed(2)}
- **Average Loss**: $${performance.avgLossAmount.toFixed(2)}
- **Largest Win**: $${performance.largestWin.toFixed(2)}
- **Largest Loss**: $${performance.largestLoss.toFixed(2)}
- **Profit Factor**: ${performance.profitFactor < 100 ? performance.profitFactor.toFixed(2) : '∞'}

### Risk Metrics
- **Max Drawdown**: ${performance.maxDrawdown.toFixed(2)}%
- **Max Consecutive Losses**: ${performance.maxConsecutiveLosses}
- **Sharpe Ratio**: ${performance.sharpeRatio !== null ? performance.sharpeRatio.toFixed(2) : 'N/A'}

### Position Analysis
- **Long Positions**: ${performance.longPositions} (Win Rate: ${performance.longWinRate.toFixed(1)}%)
- **Short Positions**: ${performance.shortPositions} (Win Rate: ${performance.shortWinRate.toFixed(1)}%)
- **Average Holding Period**: ${performance.avgHoldingPeriodHours.toFixed(1)} hours`;

  // Add recent positions
  if (recentPositions.length > 0) {
    prompt += `

## Recent Positions (Last 20)

| ID | Side | Status | Entry | Current | P&L | Return | Opened | Closed |
|----|------|--------|-------|---------|-----|--------|--------|--------|`;

    const positionsToShow = recentPositions.slice(-20).reverse();

    for (const pos of positionsToShow) {
      const returnPct =
        pos.positionSize > 0
          ? ((pos.realizedPnl || pos.unrealizedPnl) / pos.positionSize) * 100
          : 0;

      prompt += `
| ${pos.id} | ${pos.side} | ${pos.status} | $${pos.entryPrice.toFixed(2)} | $${pos.currentPrice.toFixed(2)} | $${(pos.realizedPnl || pos.unrealizedPnl).toFixed(2)} | ${returnPct >= 0 ? '+' : ''}${returnPct.toFixed(1)}% | ${new Date(pos.openedAt).toLocaleDateString()} | ${pos.closedAt ? new Date(pos.closedAt).toLocaleDateString() : 'Open'} |`;
    }
  }

  // Add market data if available
  if (marketData && marketData.klines.length > 0) {
    prompt += `

## Market Context

### ${marketData.symbol} (${marketData.interval} interval)

Recent K-line data (last ${marketData.klines.length} candles):

| Timestamp | Open | High | Low | Close | Volume |
|-----------|------|------|-----|-------|--------|`;

    const recentKlines = marketData.klines.slice(-20);

    for (const kline of recentKlines) {
      const date = new Date(kline.timestamp);
      prompt += `
| ${date.toLocaleString()} | $${kline.open.toFixed(2)} | $${kline.high.toFixed(2)} | $${kline.low.toFixed(2)} | $${kline.close.toFixed(2)} | ${kline.volume.toFixed(2)} |`;
    }

    // Calculate basic market stats
    const closes = marketData.klines.map((k) => k.close);
    const latestPrice = closes[closes.length - 1];
    const firstPrice = closes[0];
    const priceChange = ((latestPrice - firstPrice) / firstPrice) * 100;

    // Calculate volatility (standard deviation of returns)
    const returns = [];
    for (let i = 1; i < closes.length; i++) {
      returns.push((closes[i] - closes[i - 1]) / closes[i - 1]);
    }
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance =
      returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
    const volatility = Math.sqrt(variance) * 100; // as percentage

    prompt += `

**Market Analysis**:
- **Price Change**: ${priceChange >= 0 ? '+' : ''}${priceChange.toFixed(2)}%
- **Volatility**: ${volatility.toFixed(2)}%
- **Trend**: ${priceChange > 1 ? 'Bullish' : priceChange < -1 ? 'Bearish' : 'Sideways'}
`;
  }

  prompt += `

## Your Task

Analyze the data above and provide optimization suggestions:

1. **Identify Issues**: What problems do you see in the current configuration or performance?
2. **Root Causes**: What might be causing these issues based on the metrics and market context?
3. **Suggest Changes**: Which parameters should be adjusted and why?
4. **Expected Impact**: How should these changes improve performance?

**Important**:
- Only suggest changes to the mutable parameters (don't change name, description, etc.)
- Provide a clear reasoning for each suggested change
- Be conservative - small adjustments are better than radical changes
- If performance is already good, suggest minimal tweaks or note that no major changes are needed
- If there are insufficient positions (< 5 closed), note this in your reasoning and be very conservative

Respond with a JSON object containing your suggestions:

\`\`\`json
{
  "maxLeverage": 10,
  "positionStopLoss": 3.5,
  "riskPreferenceScore": 6,
  "reasoning": "Your detailed analysis and explanation here...",
  "expectedImpact": "Expected impact of these changes..."
}
\`\`\`

Include only the fields that should be changed. Do not include fields that should remain unchanged.`;

  return prompt;
}

/**
 * Build the complete optimization context
 */
export function buildOptimizationContext(
  trader: TraderContext,
  positions: PositionData[],
  marketData: { symbol: string; interval: string; klines: KlineData[] } | null,
  periodStart: Date,
  periodEnd: Date
): OptimizationContext {
  const performance = calculatePerformanceMetrics(positions);

  return {
    trader,
    performance,
    recentPositions: positions.slice(-50), // Last 50 positions
    marketData,
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
  };
}
