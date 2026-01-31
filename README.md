<div align="center">

# TraderZ

**AI-Powered Crypto Trading Battle Royale**

<p>
  <a href="https://github.com/yourusername/traderz/stargazers">
    <img src="https://img.shields.io/github/stars/yourusername/traderz?style=social" alt="GitHub Stars">
  </a>
  <a href="https://github.com/yourusername/traderz/blob/main/LICENSE">
    <img alt="License: MIT" src="https://img.shields.io/badge/License-MIT-blue.svg">
  </a>
  <a href="https://nextjs.org/">
    <img alt="Next.js" src="https://img.shields.io/badge/Next.js-16.1-black">
  </a>
  <a href="https://www.typescriptlang.org/">
    <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5.0-blue">
  </a>
  <a href="https://www.postgresql.org/">
    <img alt="PostgreSQL" src="https://img badges.io/badge/PostgreSQL-16-336791">
  </a>
</p>

</div>

---

## Overview

**TraderZ is an innovative AI trading system inspired by Battle Royale gameplay.** Deploy hundreds of AI traders with diverse strategies, risk profiles, and trading timeframes into live Binance futures markets. Watch them compete in real-time as the market naturally selects the most profitable approaches - survival of the fittest, algorithmic edition.

> Unlike traditional backtesting, TraderZ evolves in live markets, adapting to real conditions and discovering winning strategies that actually work.

<div align="center">

**Deploy → Compete → Evolve → Profit**

</div>

---

## The Battle Royale Concept

### How It Works

1. **Generate AI Traders** - Create hundreds of unique traders with varying:
   - Trading strategies (Trend, Oscillation, Arbitrage, Market Making, Scalping, Swing)
   - Risk appetites (Conservative to Aggressive, 1-10 scale)
   - Timeframe preferences (1m to 1d candles)
   - Position strategies (Martingale, Pyramid, Fixed)
   - Risk parameters (Stop loss, Take profit, Max drawdown)

2. **Deploy to Live Markets** - Connect to Binance futures with real market data

3. **Natural Selection** - Watch as:
   - Profitable traders survive and continue trading
   - Failing traders hit their stop-loss limits and get eliminated
   - Market conditions naturally favor different strategies over time

4. **Evolve and Optimize** - Analyze winning patterns to create refined generations of traders

### Why Battle Royale?

- **No Look-Ahead Bias**: Live markets eliminate backtesting illusions
- **Adaptive Discovery**: Find strategies that work in current market conditions
- **Risk Distribution**: Multiple uncorrelated strategies reduce portfolio risk
- **Continuous Evolution**: Markets change, and so do your best strategies

---

## Key Features

### AI Trader Generation

Generate 1-10 unique AI traders instantly with randomized parameters:

- **6 Trading Strategies**: Trend, Oscillation, Arbitrage, Market Making, Scalping, Swing
- **10 Aggressiveness Levels**: From conservative (1) to aggressive (10)
- **6 Position Strategies**: Martingale, Pyramid, Fixed sizing
- **Flexible Timeframes**: 1m, 5m, 15m, 30m, 1h, 4h, 1d k-line intervals
- **Active Time Windows**: Configure UTC trading hours
- **Independent Risk Controls**: Per-trader stop-loss, take-profit, leverage limits

### Market Data Readers

**9 Modular Data Sources:**

| Reader                          | Description             | Use Case                    |
| ------------------------------- | ----------------------- | --------------------------- |
| **K-line Fetcher**              | Real-time candlesticks  | Price action analysis       |
| **Funding Rate**                | Perpetual funding rates | Sentiment analysis          |
| **Order Book**                  | Bid/ask depth           | Support/resistance levels   |
| **Open Interest History**       | Historical OI data      | Trend strength confirmation |
| **Taker Buy/Sell Volume**       | Aggressed trade volume  | Momentum detection          |
| **Top Trader LS Ratio**         | Whale positioning       | Smart money tracking        |
| **Top Trader LS Account Ratio** | Whale account counts    | Market participation        |
| **Global LS Account Ratio**     | Overall sentiment       | Macro market bias           |
| **Basis**                       | Spot-futures spread     | Arbitrage opportunities     |

**Reader System:**

- **Mandatory readers**: Auto-included in all trader heartbeats
- **Optional readers**: Traders selectively subscribe based on strategy
- **Configurable parameters**: Set default values per reader
- **Test execution**: Manually execute readers with custom parameters

### Multi-Timeframe Analysis

Each trader can subscribe to multiple k-line intervals simultaneously:

- Analyze short-term (1m, 5m) and long-term (1h, 4h) trends
- Cross-timeframe confirmation for entry/exit signals
- Configurable per-trader interval limits

### Advanced Risk Management

**Per-Position Controls:**

- Stop loss and take profit percentages
- Maximum position size (USD)
- Leverage range (min/max)
- Long/Short position allowance

**Portfolio-Level Controls:**

- Maximum concurrent positions
- Maximum drawdown threshold
- Daily loss limits
- Maximum consecutive losses
- Risk preference scoring (1-10)

### Real-Time Monitoring Dashboard

**Traders Page:**

- Card-based grid view of all traders
- Status indicators (enabled/paused/disabled)
- Active/inactive status based on UTC hours
- Performance metrics (total return, P&L)
- Batch selection and operations

**Trading Page:**

- Multi-chart layout with Lightweight Charts
- Simultaneous viewing of multiple pairs/timeframes
- Timeline visualization of trader activity
- Auto-update mode for live data

**Positions Page:**

- Real-time price updates (3-second refresh)
- Filter by status, side, trader
- Sort by opened date, P&L, margin, leverage
- Position details with full history
- Manual position closure

### System Configuration

**Global Settings:**

- Minimum k-line interval constraint
- Maximum intervals per trader (1-10)
- Maximum optional readers per trader (1-20)

**These settings prevent resource overload while maintaining flexibility.**

---

## Tech Stack

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend                             │
├─────────────────────────────────────────────────────────┤
│  Next.js 16  │  React 19  │  Tailwind CSS 4  │  Framer  │
│  Lightweight Charts  │  Real-time Dashboard            │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                    Backend API                          │
├─────────────────────────────────────────────────────────┤
│       Next.js API Routes  │  Drizzle ORM  │  Zod       │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                    Database                             │
├─────────────────────────────────────────────────────────┤
│           PostgreSQL 16 (Docker)                        │
│  500+ Traders │ Positions │ History │ Performance       │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                    External Services                    │
├─────────────────────────────────────────────────────────┤
│  Binance Futures API  │  DeepSeek AI  │  WebSocket     │
└─────────────────────────────────────────────────────────┘
```

---

## Quick Start

### Prerequisites

- Node.js 18+
- Docker & Docker Compose
- Binance Futures Account (for live trading)

### 1. Clone and Install

```bash
git clone https://github.com/adamyxz/traderz.git
cd traderz
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```env
# Database
DATABASE_URL="postgresql://traderz_user:traderz_password@localhost:5432/traderz_db"

# Application
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NODE_ENV="development"

# DeepSeek AI
DEEPSEEK_API_KEY="your_deepseek_api_key_here"
```

### 3. Launch Database

```bash
npm run docker:up
npm run db:migrate
```

### 4. Start the Battle

```bash
npm run dev
```

Visit [http://localhost:3000/admin](http://localhost:3000/admin)

---

## Usage

### Admin Dashboard

The admin panel provides a comprehensive interface for managing your AI trading army:

#### Traders Management (`/admin/traders`)

**AI-Powered Trader Generation:**

- Click the **"AI+"** button to generate 1-10 unique AI traders with randomized parameters
- Each generated trader has unique characteristics:
  - **Trading strategy**: Trend, Oscillation, Arbitrage, Market Making, Scalping, or Swing
  - **Aggressiveness level**: 1-10 scale controlling trading behavior
  - **Risk tolerance**: Leverage range, position sizing, stop-loss/take-profit ratios
  - **Timeframe focus**: Preferred k-line intervals (1m, 5m, 15m, 1h, 4h, 1d)
  - **Position strategy**: Martingale, Pyramid, or Fixed sizing
  - **Active hours**: UTC time window for trading activity

**Manual Trader Creation:**

- Click **"Add Trader"** to manually configure every parameter
- Set trading pairs, risk limits, strategy type, and data reader subscriptions
- Configure multiple k-line intervals per trader for multi-timeframe analysis

**Trader Management:**

- **Search** traders by name or description
- **Filter** by status: All, Active Now, Inactive Now, Enabled, Paused, Disabled
- **Sort** by: Name, Created Date, Aggressiveness, Risk Score
- **Batch operations**: Select multiple traders for bulk deletion
- **Edit** individual trader parameters
- **View positions** filtered by specific trader

#### Trading Dashboard (`/admin/trading`)

**Multi-Chart Visualization:**

- View multiple trading charts simultaneously
- Select any trading pair (BTCUSDT, ETHUSDT, etc.)
- Choose k-line intervals (1m, 5m, 15m, 1h, 4h, 1d)
- Real-time price updates from Binance

**Timeline Visualization:**

- Enable timeline mode to see historical trader activity
- Auto-refresh keeps data current

#### Positions Monitoring (`/admin/positions`)

**Real-Time Position Tracking:**

- View all open positions across all traders
- **Live price updates** every 3 seconds
- **Status indicators**: Open, Closed, Liquidated

**Powerful Filtering:**

- **Search** by trading pair or trader name
- **Filter by status**: All, Open, Closed, Liquidated
- **Filter by side**: All, Long, Short
- **Filter by trader**: View positions for specific trader

**Sorting Options:**

- Opened time
- Unrealized P&L
- Margin
- Leverage

**Position Actions:**

- **View details**: Full position history and event log
- **Close position**: Manual position closure with confirmation

#### Data Readers (`/admin/readers`)

**Reader Management:**

- **Sync readers**: Auto-discover readers from `/readers` directory
- **Mandatory readers**: Automatically included in all trader heartbeats
- **Optional readers**: Traders can selectively subscribe

**Available Readers:**

- **K-line Fetcher** - Real-time candlestick data
- **Funding Rate** - Perpetual contract funding rates
- **Order Book** - Bid/ask depth data
- **Open Interest History** - Historical OI data
- **Taker Buy/Sell Volume** - Aggressed trade volume
- **Top Trader Long/Short Ratio** - Whale positioning
- **Top Trader LS Account Ratio** - Whale account counts
- **Global Long/Short Account Ratio** - Overall market sentiment
- **Basis** - Spot-futures spread

**Reader Testing:**

- **Execute readers** manually with custom parameters
- **View results**: Execution time, status, output data
- **Configure parameters**: Set default values for each parameter

#### System Settings (`/admin/settings`)

**Global Configuration:**

- **Min Kline Interval**: Minimum timeframe (60s - 3600s)
- **Max Intervals per Trader**: Limit timeframe subscriptions (1-10)
- **Max Optional Readers per Trader**: Limit data reader subscriptions (1-20)

---

## Project Structure

```
traderz/
├── src/
│   ├── app/                         # Next.js App Router
│   │   ├── admin/
│   │   │   ├── traders/             # Trader management
│   │   │   ├── trading/             # Live battle dashboard
│   │   │   ├── positions/           # Position monitoring
│   │   │   ├── readers/             # Data reader config
│   │   │   └── settings/            # System settings
│   │   └── api/                     # API routes
│   ├── components/                  # Shared components
│   ├── db/
│   │   ├── index.ts                 # Database connection
│   │   └── schema.ts                # Data models
│   └── lib/                         # Utilities
├── readers/                         # Market data readers
│   ├── kline-fetcher/               # Candlestick data
│   ├── funding-rate/                # Funding rates
│   ├── order-book/                  # Order book depth
│   └── ...                          # 9 total readers
├── drizzle/                         # Database migrations
└── docker-compose.yml               # PostgreSQL setup
```

---

## Database Schema

Core tables tracking your trading battle:

- **traders** - AI trader configurations and parameters
- **positions** - Currently active positions
- **position_history** - All historical trades
- **heartbeat_history** - Trader activity logs
- **trading_pairs** - Available trading instruments
- **kline_intervals** - Supported timeframes
- **readers** - Data reader configurations

[View full schema](src/db/schema.ts)

---

## Available Commands

### Development

```bash
npm run dev              # Start dev server (Turbopack)
npm run build            # Build for production
npm run start            # Start production server
npm run lint             # Run ESLint
```

### Database

```bash
npm run db:generate      # Generate migrations
npm run db:migrate       # Run migrations
npm run db:push          # Push schema changes
npm run db:studio        # Open Drizzle Studio GUI
```

### Docker

```bash
npm run docker:up        # Start PostgreSQL container
npm run docker:down      # Stop PostgreSQL
npm run docker:logs      # View database logs
```

---

## Roadmap

- [ ] **Genetic Algorithms** - Auto-breed successful traders
- [ ] **Multi-Exchange Support** - OKX, Bybit, Bybit
- [ ] **Strategy Cloning** - Fork and mutate winning traders
- [ ] **Advanced Analytics** - Correlation analysis, attribution
- [ ] **Backtesting Mode** - Pre-screen traders before deployment
- [ ] **Mobile App** - Monitor battles on the go
- [ ] **Social Trading** - Share and copy successful configurations
- [ ] **Notification System** - Telegram/Discord alerts

---

## Trading Strategies

### Supported Strategies

| Strategy          | Description                    | Best Market Type |
| ----------------- | ------------------------------ | ---------------- |
| **Trend**         | Follow directional momentum    | Trending markets |
| **Oscillation**   | Mean reversion in ranges       | Sideways markets |
| **Arbitrage**     | Exploit price inefficiencies   | Volatile markets |
| **Market Making** | Provide liquidity, earn spread | Stable markets   |
| **Scalping**      | Quick trades, small profits    | High volume      |
| **Swing**         | Capture multi-day moves        | All markets      |

### Position Strategies

- **Martingale** - Double position on loss (High risk, high reward)
- **Pyramid** - Add to winners (Trend following)
- **None** - Fixed position size (Conservative)

---

## Risk Warning

**This software is for educational and research purposes only.**

Cryptocurrency futures trading involves **substantial risk of loss** and is not suitable for every investor. You could potentially lose more than your initial investment.

- Never trade with money you cannot afford to lose
- Past performance does not guarantee future results
- The authors are not responsible for any financial losses
- Use at your own risk

---

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## Disclaimer

TraderZ is an experimental trading system. It does not constitute financial advice. Always conduct your own research and consult with a qualified financial advisor before making investment decisions.

---

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=yourusername/traderz&type=Date)](https://star-history.com/#yourusername/traderz&Date)

---

<div align="center">

**Built with ❤️ by the TraderZ Team**

**May the best strategy win! 🚀**

</div>
