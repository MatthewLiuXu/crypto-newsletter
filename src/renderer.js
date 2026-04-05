import Handlebars from 'handlebars';
import {
  directionFromChange,
  formatCompactCurrency,
  formatCurrency,
  formatPercent,
  formatSignedPercent,
  normalizeWhitespace,
} from './helpers.js';

function priceArrow(direction) {
  if (direction === 'up') return '▴';
  if (direction === 'down') return '▾';
  return '▸';
}

function fearGreedColor(score) {
  if (!Number.isFinite(score)) return 'rgba(255,255,255,0.75)';
  if (score >= 55) return '#00c896';
  if (score <= 30) return '#ff4d6a';
  return '#fbbf24';
}

function formatShortDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date);
}

function buildViewModel(briefing) {
  const prices = (briefing.market?.prices || []).map((price) => {
    const direction = price.direction || directionFromChange(price.change24h);
    return {
      symbol: price.symbol,
      priceDisplay: formatCurrency(price.price, price.price < 1000 ? 2 : 0),
      changeClass: direction,
      changeDisplay: `${priceArrow(direction)} ${formatSignedPercent(price.change24h)}`,
    };
  });

  const onChain = (briefing.onChain || []).map((item) => ({
    ...item,
    valueDisplay: formatCompactCurrency(item.value),
    deltaClass: item.direction || 'flat',
  }));

  const predictions = (briefing.predictions || []).map((item) => ({
    ...item,
    fillWidth: Math.max(1, Math.min(99, item.probability || 0)),
    probabilityDisplay: `${item.probability}%`,
    resolutionLabel: formatShortDate(item.endDate),
  }));

  const kols = (briefing.kols || []).map((item) => ({
    ...item,
    handleDisplay: item.handle?.startsWith('@') ? item.handle : `@${item.handle}`,
    quote: normalizeWhitespace(item.quote),
  }));

  const deepReads = (briefing.deepReads || []).map((item, index) => ({
    ...item,
    numberLabel: String(index + 1).padStart(2, '0'),
  }));

  const deals = (briefing.deals || []).map((item) => ({
    ...item,
    detail: item.description,
  }));

  const regulationSecurity = (briefing.regulationSecurity || []).map((item) => ({
    ...item,
    bulletColor: item.category === 'Cybersecurity' ? '#ff8844' : '#ff4d6a',
  }));

  const chart = briefing.chartOfTheDay
    ? {
      ...briefing.chartOfTheDay,
      captionHtml: new Handlebars.SafeString(briefing.chartOfTheDay.caption),
      bars: briefing.chartOfTheDay.bars.map((bar) => ({
        ...bar,
        tvlDisplay: formatCompactCurrency(bar.tvl),
      })),
    }
    : null;

  return {
    displayDate: briefing.displayDate,
    issueNumber: briefing.issueNumber,
    market: {
      prices,
      hasPrices: prices.length > 0,
      totalMarketCapDisplay: formatCompactCurrency(briefing.market?.totalMarketCap),
      btcDominanceDisplay: formatPercent(briefing.market?.btcDominance),
      fearGreedDisplay: briefing.market?.fearGreed
        ? `${briefing.market.fearGreed.score} - ${normalizeWhitespace(briefing.market.fearGreed.label)}`
        : 'Unavailable',
      fearGreedColor: fearGreedColor(briefing.market?.fearGreed?.score),
      narrativeHtml: new Handlebars.SafeString(
        briefing.market?.narrative || 'Live market commentary was unavailable for this issue.'
      ),
    },
    headlines: briefing.headlines || [],
    hasHeadlines: (briefing.headlines || []).length > 0,
    deals,
    hasDeals: deals.length > 0,
    onChain,
    hasOnChain: onChain.length > 0,
    chart,
    hasChart: Boolean(chart),
    regulationSecurity,
    hasRegulationSecurity: regulationSecurity.length > 0,
    predictions,
    hasPredictions: predictions.length > 0,
    kols,
    hasKols: kols.length > 0,
    deepReads,
    hasDeepReads: deepReads.length > 0,
  };
}

const templateSource = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Crypto Morning Briefing</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Outfit:wght@300;400;500;600;700;800&display=swap');

  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    background: #0a0a0f;
    font-family: 'Outfit', sans-serif;
    color: #e0e0e8;
    -webkit-font-smoothing: antialiased;
  }

  .email-wrapper {
    max-width: 680px;
    margin: 0 auto;
    background: #0f0f18;
    border-left: 1px solid rgba(255,255,255,0.04);
    border-right: 1px solid rgba(255,255,255,0.04);
  }

  .header {
    background: linear-gradient(135deg, #0a0a12 0%, #12121f 50%, #0d1a2a 100%);
    padding: 40px 36px 32px;
    border-bottom: 1px solid rgba(80, 200, 255, 0.08);
    position: relative;
    overflow: hidden;
  }
  .header::before {
    content: '';
    position: absolute;
    top: -60px; right: -60px;
    width: 200px; height: 200px;
    background: radial-gradient(circle, rgba(0, 200, 150, 0.06) 0%, transparent 70%);
    border-radius: 50%;
  }
  .header::after {
    content: '';
    position: absolute;
    bottom: -40px; left: 30%;
    width: 300px; height: 100px;
    background: radial-gradient(ellipse, rgba(80, 130, 255, 0.04) 0%, transparent 70%);
  }

  .logo-row {
    display: flex;
    align-items: center;
    gap: 14px;
    margin-bottom: 20px;
    position: relative;
    z-index: 1;
  }
  .logo-icon {
    width: 44px; height: 44px;
    background: linear-gradient(135deg, #00c896 0%, #0088ff 100%);
    border-radius: 10px;
    display: flex; align-items: center; justify-content: center;
    font-size: 22px; font-weight: 800;
    color: #fff;
    letter-spacing: -1px;
    box-shadow: 0 4px 20px rgba(0, 200, 150, 0.2);
  }
  .logo-text {
    font-size: 20px;
    font-weight: 700;
    color: #ffffff;
    letter-spacing: 0.5px;
  }
  .logo-text span {
    color: #00c896;
  }

  .date-line {
    font-family: 'Space Mono', monospace;
    font-size: 12px;
    color: rgba(255,255,255,0.35);
    letter-spacing: 2px;
    text-transform: uppercase;
    position: relative;
    z-index: 1;
  }

  .divider {
    height: 1px;
    background: linear-gradient(90deg, transparent 0%, rgba(0, 200, 150, 0.15) 20%, rgba(0, 136, 255, 0.15) 80%, transparent 100%);
    margin: 0;
  }

  .section {
    padding: 32px 36px;
  }

  .section-label {
    font-family: 'Space Mono', monospace;
    font-size: 10px;
    letter-spacing: 3px;
    text-transform: uppercase;
    color: #00c896;
    margin-bottom: 16px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .section-label::after {
    content: '';
    flex: 1;
    height: 1px;
    background: linear-gradient(90deg, rgba(0,200,150,0.2), transparent);
  }

  .price-grid {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 12px;
    margin-bottom: 24px;
  }
  .price-card {
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 12px;
    padding: 16px;
    text-align: center;
  }
  .price-symbol {
    font-family: 'Space Mono', monospace;
    font-size: 11px;
    color: rgba(255,255,255,0.4);
    letter-spacing: 1.5px;
    margin-bottom: 6px;
  }
  .price-value {
    font-size: 22px;
    font-weight: 700;
    color: #fff;
    margin-bottom: 4px;
  }
  .price-change {
    font-family: 'Space Mono', monospace;
    font-size: 12px;
    font-weight: 600;
  }
  .price-change.up { color: #00c896; }
  .price-change.down { color: #ff4d6a; }
  .price-change.flat { color: rgba(255,255,255,0.35); }

  .stats-row {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 12px;
    margin-bottom: 24px;
  }
  .stat-item {
    text-align: center;
    padding: 12px 8px;
    background: rgba(255,255,255,0.02);
    border-radius: 8px;
  }
  .stat-label {
    font-size: 10px;
    font-family: 'Space Mono', monospace;
    color: rgba(255,255,255,0.3);
    letter-spacing: 1px;
    text-transform: uppercase;
    margin-bottom: 4px;
  }
  .stat-value {
    font-size: 15px;
    font-weight: 600;
    color: #fff;
  }

  .market-narrative {
    font-size: 15px;
    line-height: 1.75;
    color: rgba(255,255,255,0.65);
    padding: 20px 24px;
    background: rgba(255,255,255,0.02);
    border-radius: 12px;
    border-left: 3px solid rgba(0, 200, 150, 0.3);
  }
  .market-narrative strong {
    color: #ffffff;
    font-weight: 600;
  }

  .headline-list {
    list-style: none;
    padding: 0;
  }
  .headline-item {
    padding: 16px 0;
    border-bottom: 1px solid rgba(255,255,255,0.04);
    display: flex;
    gap: 14px;
    align-items: flex-start;
  }
  .headline-item:last-child {
    border-bottom: none;
  }
  .headline-bullet {
    width: 6px; height: 6px;
    min-width: 6px;
    background: #00c896;
    border-radius: 50%;
    margin-top: 8px;
  }
  .headline-text {
    font-size: 14.5px;
    line-height: 1.6;
    color: rgba(255,255,255,0.7);
  }
  .headline-link {
    color: inherit;
    text-decoration: none;
  }
  .headline-link:hover {
    color: #ffffff;
  }
  .headline-text strong {
    color: #ffffff;
    font-weight: 600;
  }
  .source-tag {
    display: inline-block;
    font-family: 'Space Mono', monospace;
    font-size: 10px;
    color: rgba(0, 200, 150, 0.6);
    background: rgba(0, 200, 150, 0.06);
    border: 1px solid rgba(0, 200, 150, 0.1);
    padding: 1px 6px;
    border-radius: 4px;
    margin-left: 6px;
    letter-spacing: 0.5px;
    vertical-align: middle;
  }
  .source-tag-link {
    text-decoration: none;
  }
  .category-tag {
    display: inline-block;
    font-family: 'Space Mono', monospace;
    font-size: 9px;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    padding: 3px 8px;
    border-radius: 4px;
    margin-bottom: 6px;
  }
  .cat-vc { background: rgba(130, 80, 255, 0.1); color: #a78bfa; border: 1px solid rgba(130,80,255,0.15); }
  .cat-ma { background: rgba(255, 180, 50, 0.1); color: #fbbf24; border: 1px solid rgba(255,180,50,0.15); }
  .cat-launch { background: rgba(0, 200, 150, 0.1); color: #00c896; border: 1px solid rgba(0,200,150,0.15); }
  .cat-reg { background: rgba(255, 77, 106, 0.1); color: #ff4d6a; border: 1px solid rgba(255,77,106,0.15); }
  .cat-security { background: rgba(255, 100, 50, 0.1); color: #ff8844; border: 1px solid rgba(255,100,50,0.15); }

  .deal-card {
    background: rgba(255,255,255,0.025);
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 12px;
    padding: 20px 24px;
    margin-bottom: 12px;
  }
  .deal-card:last-child {
    margin-bottom: 0;
  }
  .deal-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 12px;
    margin-bottom: 8px;
  }
  .deal-company {
    font-size: 16px;
    font-weight: 700;
    color: #fff;
    line-height: 1.4;
  }
  .deal-link {
    color: #fff;
    text-decoration: none;
  }
  .deal-link:hover {
    color: #00c896;
  }
  .deal-amount {
    font-family: 'Space Mono', monospace;
    font-size: 12px;
    font-weight: 700;
    color: #00c896;
    white-space: nowrap;
  }
  .deal-details {
    font-size: 13.5px;
    color: rgba(255,255,255,0.5);
    line-height: 1.6;
  }

  .chart-section {
    background: rgba(255,255,255,0.02);
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 14px;
    overflow: hidden;
  }
  .chart-caption {
    padding: 20px 24px 16px;
    font-size: 14px;
    line-height: 1.65;
    color: rgba(255,255,255,0.6);
  }
  .chart-caption strong {
    color: #fff;
  }
  .chart-bars {
    padding: 0 24px 20px;
  }
  .chart-row {
    display: grid;
    grid-template-columns: 120px 1fr 72px;
    gap: 12px;
    align-items: center;
    margin-bottom: 12px;
  }
  .chart-row:last-child {
    margin-bottom: 0;
  }
  .chart-label {
    font-family: 'Space Mono', monospace;
    font-size: 11px;
    color: rgba(255,255,255,0.5);
  }
  .chart-bar-bg {
    height: 10px;
    background: rgba(255,255,255,0.06);
    border-radius: 999px;
    overflow: hidden;
  }
  .chart-bar-fill {
    height: 100%;
    border-radius: 999px;
  }
  .chart-value {
    font-family: 'Space Mono', monospace;
    font-size: 11px;
    color: rgba(255,255,255,0.45);
    text-align: right;
  }
  .chart-source {
    font-family: 'Space Mono', monospace;
    font-size: 10px;
    color: rgba(255,255,255,0.25);
    padding: 12px 24px 16px;
    letter-spacing: 0.5px;
  }

  .onchain-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }
  .onchain-card {
    background: rgba(255,255,255,0.025);
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 10px;
    padding: 16px 18px;
  }
  .onchain-label {
    font-size: 11px;
    font-family: 'Space Mono', monospace;
    color: rgba(255,255,255,0.3);
    letter-spacing: 1px;
    text-transform: uppercase;
    margin-bottom: 6px;
  }
  .onchain-value {
    font-size: 20px;
    font-weight: 700;
    color: #fff;
    margin-bottom: 2px;
  }
  .onchain-delta {
    font-family: 'Space Mono', monospace;
    font-size: 11px;
  }
  .onchain-delta.up { color: #00c896; }
  .onchain-delta.down { color: #ff4d6a; }
  .onchain-delta.flat { color: rgba(255,255,255,0.35); }

  .prediction-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }
  .prediction-card {
    background: rgba(255,255,255,0.025);
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 10px;
    padding: 16px;
  }
  .prediction-question {
    font-size: 13px;
    color: rgba(255,255,255,0.55);
    line-height: 1.5;
    margin-bottom: 10px;
  }
  .prediction-bar-bg {
    height: 6px;
    background: rgba(255,255,255,0.06);
    border-radius: 3px;
    overflow: hidden;
    margin-bottom: 6px;
  }
  .prediction-bar-fill {
    height: 100%;
    border-radius: 3px;
    background: linear-gradient(90deg, #00c896, #0088ff);
  }
  .prediction-odds {
    font-family: 'Space Mono', monospace;
    font-size: 18px;
    font-weight: 700;
    color: #fff;
  }
  .prediction-label {
    font-family: 'Space Mono', monospace;
    font-size: 10px;
    color: rgba(255,255,255,0.25);
    letter-spacing: 0.5px;
  }

  .kol-card {
    background: rgba(255,255,255,0.025);
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 12px;
    padding: 18px 22px;
    margin-bottom: 12px;
  }
  .kol-card:last-child {
    margin-bottom: 0;
  }
  .kol-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 10px;
  }
  .kol-avatar {
    width: 38px; height: 38px;
    border-radius: 50%;
    background: linear-gradient(135deg, #1d9bf0 0%, #0d6ebd 100%);
    display: flex; align-items: center; justify-content: center;
    font-size: 16px; font-weight: 700; color: #fff;
    flex-shrink: 0;
  }
  .kol-name {
    font-size: 14px;
    font-weight: 700;
    color: #fff;
  }
  .kol-handle {
    font-family: 'Space Mono', monospace;
    font-size: 11px;
    color: #1d9bf0;
    letter-spacing: 0.3px;
  }
  .kol-quote {
    font-size: 14px;
    line-height: 1.7;
    color: rgba(255,255,255,0.6);
    padding-left: 50px;
    font-style: italic;
  }
  .kol-engagement {
    display: flex;
    gap: 16px;
    padding-left: 50px;
    margin-top: 8px;
    font-family: 'Space Mono', monospace;
    font-size: 10px;
    color: rgba(255,255,255,0.25);
    letter-spacing: 0.5px;
  }

  .extra-read {
    display: flex;
    gap: 16px;
    padding: 18px 0;
    border-bottom: 1px solid rgba(255,255,255,0.04);
    align-items: flex-start;
  }
  .extra-read:last-child { border-bottom: none; }
  .read-number {
    font-family: 'Space Mono', monospace;
    font-size: 28px;
    font-weight: 700;
    color: rgba(0, 200, 150, 0.15);
    min-width: 40px;
    line-height: 1;
    padding-top: 2px;
  }
  .read-title {
    font-size: 15px;
    font-weight: 600;
    color: #fff;
    margin-bottom: 4px;
    line-height: 1.4;
  }
  .read-link {
    color: #fff;
    text-decoration: none;
  }
  .read-link:hover {
    color: #00c896;
  }
  .read-desc {
    font-size: 13px;
    color: rgba(255,255,255,0.45);
    line-height: 1.5;
  }

  .empty-state {
    background: rgba(255,255,255,0.025);
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 12px;
    padding: 18px 20px;
    color: rgba(255,255,255,0.45);
    font-size: 14px;
    line-height: 1.6;
  }

  .footer {
    padding: 32px 36px;
    background: rgba(0,0,0,0.3);
    border-top: 1px solid rgba(255,255,255,0.04);
    text-align: center;
  }
  .footer-links {
    display: flex;
    justify-content: center;
    gap: 24px;
    margin-bottom: 16px;
  }
  .footer-link {
    font-family: 'Space Mono', monospace;
    font-size: 11px;
    color: rgba(255,255,255,0.3);
    text-decoration: none;
    letter-spacing: 1px;
    text-transform: uppercase;
  }
  .footer-copy {
    font-size: 12px;
    color: rgba(255,255,255,0.15);
    margin-top: 12px;
  }
  .footer-unsub {
    font-size: 11px;
    color: rgba(255,255,255,0.2);
    margin-top: 12px;
  }

  @media (max-width: 600px) {
    .section { padding: 24px 20px; }
    .header { padding: 28px 20px 24px; }
    .price-grid { grid-template-columns: 1fr; }
    .stats-row { grid-template-columns: 1fr; }
    .onchain-grid { grid-template-columns: 1fr; }
    .prediction-grid { grid-template-columns: 1fr; }
    .chart-row { grid-template-columns: 1fr; gap: 8px; }
    .chart-value { text-align: left; }
    .price-value { font-size: 20px; }
    .footer { padding: 24px 20px; }
    .kol-quote, .kol-engagement { padding-left: 0; }
  }
</style>
</head>
<body>

<div class="email-wrapper">
  <div class="header">
    <div class="logo-row">
      <div class="logo-icon">CB</div>
      <div class="logo-text">Crypto <span>Morning Briefing</span></div>
    </div>
    <div class="date-line">{{displayDate}} &nbsp;·&nbsp; Issue #{{issueNumber}}</div>
  </div>

  <div class="divider"></div>

  <div class="section">
    <div class="section-label">Market Snapshot</div>

    {{#if market.hasPrices}}
    <div class="price-grid">
      {{#each market.prices}}
      <div class="price-card">
        <div class="price-symbol">{{symbol}}</div>
        <div class="price-value">{{priceDisplay}}</div>
        <div class="price-change {{changeClass}}">{{changeDisplay}}</div>
      </div>
      {{/each}}
    </div>
    {{else}}
    <div class="empty-state">Price data was unavailable from the market feeds for this issue.</div>
    {{/if}}

    <div class="stats-row">
      <div class="stat-item">
        <div class="stat-label">Total Mkt Cap</div>
        <div class="stat-value">{{market.totalMarketCapDisplay}}</div>
      </div>
      <div class="stat-item">
        <div class="stat-label">BTC Dominance</div>
        <div class="stat-value">{{market.btcDominanceDisplay}}</div>
      </div>
      <div class="stat-item">
        <div class="stat-label">Fear &amp; Greed</div>
        <div class="stat-value" style="color: {{market.fearGreedColor}};">{{market.fearGreedDisplay}}</div>
      </div>
    </div>

    <div class="market-narrative">{{{market.narrativeHtml}}}</div>
  </div>

  <div class="divider"></div>

  <div class="section">
    <div class="section-label">Headlines</div>

    {{#if hasHeadlines}}
    <ul class="headline-list">
      {{#each headlines}}
      <li class="headline-item">
        <div class="headline-bullet"></div>
        <div class="headline-text">
          <a href="{{link}}" class="headline-link"><strong>{{title}}</strong></a> <a href="{{link}}" class="source-tag-link"><span class="source-tag">{{source}}</span></a>
        </div>
      </li>
      {{/each}}
    </ul>
    {{else}}
    <div class="empty-state">RSS headlines were unavailable from the configured feeds for this issue.</div>
    {{/if}}
  </div>

  <div class="divider"></div>

  <div class="section">
    <div class="section-label">Deals &amp; Launches</div>

    {{#if hasDeals}}
    {{#each deals}}
    <div class="deal-card">
      <div class="category-tag {{categoryClass}}">{{category}}</div>
      <div class="deal-header">
        <div class="deal-company"><a href="{{link}}" class="deal-link">{{title}}</a></div>
        <div class="deal-amount">{{source}}</div>
      </div>
      <div class="deal-details">{{detail}}</div>
    </div>
    {{/each}}
    {{else}}
    <div class="empty-state">No high-confidence deal or launch stories were found in the publication feeds for this issue.</div>
    {{/if}}
  </div>

  <div class="divider"></div>

  <div class="section">
    <div class="section-label">On-Chain Pulse</div>

    {{#if hasOnChain}}
    <div class="onchain-grid">
      {{#each onChain}}
      <div class="onchain-card">
        <div class="onchain-label">{{label}}</div>
        <div class="onchain-value">{{valueDisplay}}</div>
        <div class="onchain-delta {{deltaClass}}">{{delta}}</div>
      </div>
      {{/each}}
    </div>
    {{else}}
    <div class="empty-state">On-chain metrics were unavailable from DeFi Llama for this issue.</div>
    {{/if}}
  </div>

  <div class="divider"></div>

  <div class="section">
    <div class="section-label">Chart of the Day</div>

    {{#if hasChart}}
    <div class="chart-section">
      <div class="chart-caption">{{{chart.captionHtml}}}</div>
      <div class="chart-bars">
        {{#each chart.bars}}
        <div class="chart-row">
          <div class="chart-label">{{name}}</div>
          <div class="chart-bar-bg"><div class="chart-bar-fill" style="width: {{width}}%; background: {{fill}};"></div></div>
          <div class="chart-value">{{tvlDisplay}}</div>
        </div>
        {{/each}}
      </div>
      <div class="chart-source">{{chart.source}}</div>
    </div>
    {{else}}
    <div class="empty-state">Chart data was unavailable for this issue.</div>
    {{/if}}
  </div>

  <div class="divider"></div>

  <div class="section">
    <div class="section-label">Regulation &amp; Security</div>

    {{#if hasRegulationSecurity}}
    <ul class="headline-list">
      {{#each regulationSecurity}}
      <li class="headline-item">
        <div class="headline-bullet" style="background: {{bulletColor}};"></div>
        <div class="headline-text">
          <span class="category-tag {{categoryClass}}">{{category}}</span><br>
          <a href="{{link}}" class="headline-link"><strong>{{title}}</strong>{{#if description}} — {{description}}{{/if}}</a> <a href="{{link}}" class="source-tag-link"><span class="source-tag">{{source}}</span></a>
        </div>
      </li>
      {{/each}}
    </ul>
    {{else}}
    <div class="empty-state">No regulation or security stories were surfaced from the publication feeds for this issue.</div>
    {{/if}}
  </div>

  <div class="divider"></div>

  <div class="section">
    <div class="section-label">Prediction Markets</div>

    {{#if hasPredictions}}
    <div class="prediction-grid">
      {{#each predictions}}
      <div class="prediction-card">
        <div class="prediction-question">{{question}}</div>
        <div class="prediction-bar-bg"><div class="prediction-bar-fill" style="width: {{fillWidth}}%;"></div></div>
        <div style="display: flex; justify-content: space-between; align-items: baseline;">
          <div class="prediction-odds">{{probabilityDisplay}}</div>
          <div class="prediction-label">{{platform}}{{#if resolutionLabel}} · {{resolutionLabel}}{{/if}}</div>
        </div>
      </div>
      {{/each}}
    </div>
    {{else}}
    <div class="empty-state">No crypto-relevant active prediction contracts were found in the Polymarket feed for this issue.</div>
    {{/if}}
  </div>

  <div class="divider"></div>

  <div class="section">
    <div class="section-label">Twitter KOLs — What CT Is Saying</div>

    {{#if hasKols}}
    {{#each kols}}
    <div class="kol-card">
      <div class="kol-header">
        <div class="kol-avatar">{{avatarInitial}}</div>
        <div>
          <div class="kol-name">{{name}}</div>
          <div class="kol-handle">{{handleDisplay}}</div>
        </div>
      </div>
      <div class="kol-quote">"{{quote}}"</div>
      <div class="kol-engagement">
        <span>♡ {{likes}}</span>
        <span>⟲ {{retweets}}</span>
        <span>👁 {{views}} views</span>
      </div>
    </div>
    {{/each}}
    {{else}}
    <div class="empty-state">KOL commentary was unavailable from the configured X accounts for this issue.</div>
    {{/if}}
  </div>

  <div class="divider"></div>

  <div class="section">
    <div class="section-label">Deep Reads</div>

    {{#if hasDeepReads}}
    {{#each deepReads}}
    <div class="extra-read">
      <div class="read-number">{{numberLabel}}</div>
      <div class="read-content">
        <div class="read-title"><a href="{{link}}" class="read-link">{{title}}</a></div>
        <div class="read-desc">{{description}} &nbsp;<a href="{{link}}" class="source-tag-link"><span class="source-tag">{{source}}</span></a></div>
      </div>
    </div>
    {{/each}}
    {{else}}
    <div class="empty-state">Longer-form reads were unavailable from the RSS feeds for this issue.</div>
    {{/if}}
  </div>

  <div class="divider"></div>

  <div class="footer">
    <div class="logo-row" style="justify-content: center; margin-bottom: 16px;">
      <div class="logo-icon" style="width: 32px; height: 32px; font-size: 16px; border-radius: 8px;">CB</div>
      <div class="logo-text" style="font-size: 16px;">Crypto <span style="color: #00c896;">Morning Briefing</span></div>
    </div>
    <div class="footer-links">
      <a href="#" class="footer-link">Follow on X</a>
      <a href="#" class="footer-link">Archive</a>
      <a href="#" class="footer-link">Share on X</a>
    </div>
    <div class="footer-copy">Generated from live market, media, and social feeds.</div>
    <div class="footer-unsub">You&apos;re receiving this because you subscribed.</div>
  </div>
</div>

</body>
</html>
`;

const template = Handlebars.compile(templateSource);

export function renderBriefing(briefing) {
  return template(buildViewModel(briefing));
}
