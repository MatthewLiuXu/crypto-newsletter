# Crypto Morning Briefing

An automated crypto market intelligence aggregator that generates styled HTML briefings from 8 real-time data sources.

## Features

- **Market Data** — BTC, ETH, SOL prices, market cap, and BTC dominance via CoinGecko
- **Sentiment** — Fear & Greed Index tracking
- **On-Chain Metrics** — Stablecoin supply and top chain TVL via DeFi Llama
- **News Curation** — Headlines from CoinTelegraph, Decrypt, CoinDesk, Blockworks, Bitcoin Magazine, and The Block
- **KOL Tracking** — Recent tweets from 12 tracked crypto accounts (ZachXBT, Murad, Cobie, etc.)
- **Prediction Markets** — Crypto-related markets from Polymarket
- **Market Narrative** — Auto-generated prose summary based on current conditions
- **Resilient Fetching** — Parallel data fetching with per-source failure isolation

## Tech Stack

- Node.js (ES Modules)
- Handlebars (HTML templating)
- fast-xml-parser (RSS feed parsing)

## Setup

```bash
git clone <repo-url>
cd crypto-newsletter
npm install
```

Create a `.env` file:

```
COINGECKO_API_KEY=your_key_here
GETXAPI_KEY=your_key_here
```

## Usage

**Generate a one-time briefing:**

```bash
npm run generate
```

Outputs a dated HTML file and `latest.html` to the `output/` directory.

**Run as a server:**

```bash
npm start
```

| Endpoint | Description |
|---|---|
| `GET /` | Serve the latest briefing |
| `GET /generate` | Force regenerate the briefing |
| `GET /health` | Health check |
| `GET /briefings/:name.html` | Serve a specific dated briefing |

## Configuration

| Variable | Required | Default | Description |
|---|---|---|---|
| `COINGECKO_API_KEY` | Yes | — | CoinGecko API key |
| `GETXAPI_KEY` | Yes | — | GetX API key for Twitter/X data |
| `PORT` | No | `3000` | Server port |
| `GETXAPI_MAX_KOL_CALLS` | No | `7` | Max KOL accounts to query per run |
| `GETXAPI_MIN_KOL_CALLS` | No | `5` | Min KOL accounts required |

## Project Structure

```
src/
├── index.js          # CLI entry point (one-shot generation)
├── server.js         # HTTP server
├── generator.js      # Orchestrates aggregation, rendering, and file output
├── aggregator.js     # Data fetching, scoring, and curation logic
├── renderer.js       # Handlebars HTML template and rendering
├── helpers.js        # Date and formatting utilities
└── sources/
    ├── coingecko.js  # Prices and global market data
    ├── twitter.js    # KOL tweet fetching
    ├── rss.js        # News headline parsing
    ├── polymarket.js # Prediction market data
    ├── defillama.js  # Stablecoin supply and chain TVL
    └── feargreed.js  # Sentiment index
output/               # Generated HTML briefings
```
