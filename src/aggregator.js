import { fetchGlobal, fetchPrices } from './sources/coingecko.js';
import { fetchFearGreed } from './sources/feargreed.js';
import { fetchStablecoinSupply, fetchChainTVL } from './sources/defillama.js';
import { fetchRSSHeadlines } from './sources/rss.js';
import { fetchPolymarketOdds } from './sources/polymarket.js';
import { fetchKOLTweets } from './sources/twitter.js';
import {
  computeIssueNumber,
  formatCompactCurrency,
  formatCurrency,
  formatDisplayDate,
  formatISODate,
  formatPercent,
  formatSignedPercent,
  normalizeWhitespace,
  truncateText,
} from './helpers.js';

const RSS_INCLUDE_PATTERNS = [
  /btc|bitcoin|ethereum|eth\b|solana|sol\b|xrp|doge/i,
  /crypto|blockchain|defi|nft|web3|stablecoin|token|on-chain/i,
  /coinbase|binance|kraken|polymarket|kalshi|tether|usdc|usdt/i,
  /digital asset|etf|sec|cftc|mining|validator/i,
];

const RSS_EXCLUDE_PATTERNS = [
  /anthropic|claude|chatgpt|openai|llm|artificial intelligence|\bai\b/i,
];

const DEAL_PATTERNS = [
  { label: 'M&A', className: 'cat-ma', titleOnly: true, patterns: [/\bacqui(?:re|res|red|sition)\b/i, /\bmerger\b/i, /\btakeover\b/i] },
  { label: 'Capital', className: 'cat-vc', titleOnly: true, patterns: [/\bseed\b/i, /\bseries [abc]\b/i, /\bfunding\b/i, /\braise[sd]?\b/i, /\bbacked by\b/i, /\bcredit line\b/i] },
  { label: 'Partnership', className: 'cat-vc', titleOnly: true, patterns: [/\bpartner(?:s|ship|ed)?\b/i, /\bcollaborat(?:e|ion)\b/i, /\bintegrat(?:e|ion|es)\b/i] },
  { label: 'Launch', className: 'cat-launch', titleOnly: true, patterns: [/\blaunch(?:es|ed)?\b/i, /\bunveil(?:s|ed)?\b/i, /\bdebut(?:s|ed)?\b/i, /\broll(?:s)? out\b/i, /\bopens waitlist\b/i, /\bgoes live\b/i] },
];

const REG_SECURITY_PATTERNS = [
  { label: 'Cybersecurity', className: 'cat-security', minTextHits: 2, patterns: [/\bexploit\b/i, /\bhack(?:ed|ing)?\b/i, /\bbreach\b/i, /\bsecurity\b/i, /\bphishing\b/i, /\bfreeze(?:s|ing)?\b/i, /\bdrain(?:ed)?\b/i, /\bvulnerability\b/i] },
  { label: 'Regulation', className: 'cat-reg', minTextHits: 2, patterns: [/\bsec\b/i, /\bcftc\b/i, /\bjudge\b/i, /\bcourt\b/i, /\blawsuit\b/i, /\bregulat(?:ion|ory|e|es)\b/i, /\bpolicy\b/i, /\bimf\b/i, /\blegislat(?:ion|ive)\b/i, /\blaw\b/i] },
];

function summarizeError(error) {
  return error instanceof Error ? error.message : String(error);
}

async function settleSources() {
  const tasks = {
    prices: fetchPrices(),
    global: fetchGlobal(),
    fearGreed: fetchFearGreed(),
    stablecoinSupply: fetchStablecoinSupply(),
    chainTvl: fetchChainTVL(),
    rss: fetchRSSHeadlines(),
    predictions: fetchPolymarketOdds(24),
    kols: fetchKOLTweets(5),
  };

  const names = Object.keys(tasks);
  const settled = await Promise.allSettled(Object.values(tasks));

  const values = {};
  const failures = [];

  settled.forEach((result, index) => {
    const name = names[index];
    if (result.status === 'fulfilled') {
      values[name] = result.value;
      return;
    }

    values[name] = null;
    failures.push({
      source: name,
      error: summarizeError(result.reason),
    });
  });

  return { values, failures };
}

function selectDeepReads(headlines, count = 4, excludedLinks = new Set()) {
  return selectDiverseArticles(headlines, count, 1, excludedLinks);
}

function headlineScore(item) {
  const haystack = normalizeWhitespace(`${item.title} ${item.description}`);
  const includeScore = RSS_INCLUDE_PATTERNS.reduce((score, pattern) => (
    pattern.test(haystack) ? score + 1 : score
  ), 0);

  if (includeScore === 0 && RSS_EXCLUDE_PATTERNS.some((pattern) => pattern.test(haystack))) {
    return -1;
  }

  return includeScore;
}

function articleText(item) {
  return normalizeWhitespace(`${item.title} ${item.description}`);
}

function selectDiverseArticles(items, count, maxPerSource = 2, excludedLinks = new Set()) {
  const selected = [];
  const sourceCounts = new Map();

  for (const item of items) {
    if (excludedLinks.has(item.link)) continue;

    const currentCount = sourceCounts.get(item.source) || 0;
    if (currentCount >= maxPerSource) continue;

    selected.push(item);
    sourceCounts.set(item.source, currentCount + 1);

    if (selected.length === count) break;
  }

  if (selected.length < count) {
    for (const item of items) {
      if (excludedLinks.has(item.link) || selected.some((entry) => entry.link === item.link)) continue;
      selected.push(item);
      if (selected.length === count) break;
    }
  }

  return selected;
}

function classifyArticle(item, classifiers) {
  const title = normalizeWhitespace(item.title);
  const haystack = articleText(item);
  for (const classifier of classifiers) {
    const titleHits = classifier.patterns.filter((pattern) => pattern.test(title)).length;
    const textHits = classifier.patterns.filter((pattern) => pattern.test(haystack)).length;
    const passes = classifier.titleOnly ? titleHits > 0 : titleHits > 0 || textHits >= (classifier.minTextHits || 1);

    if (passes) {
      return {
        ...item,
        category: classifier.label,
        categoryClass: classifier.className,
        _categoryScore: titleHits * 10 + textHits,
      };
    }
  }
  return null;
}

function inferTopicHint(title) {
  const normalized = normalizeWhitespace(title).toLowerCase();
  const hints = [
    'kalshi',
    'drift',
    'schwab',
    'circle',
    'imf',
    'ant group',
    'anvita',
    'zachxbt',
    'megaeth',
    'polymarket',
    'durov',
    'riot',
  ];

  return hints.find((hint) => normalized.includes(hint)) || null;
}

function selectClassifiedArticles(items, classifiers, count, excludedLinks = new Set(), { dedupeTopics = false } = {}) {
  const classified = items
    .filter((item) => !excludedLinks.has(item.link))
    .map((item) => classifyArticle(item, classifiers))
    .filter(Boolean)
    .sort((a, b) => b._categoryScore - a._categoryScore)
    .map(({ _categoryScore, ...item }) => item);

  if (!dedupeTopics) {
    return selectDiverseArticles(classified, count, 1, excludedLinks);
  }

  const selected = [];
  const sourceCounts = new Map();
  const topicHints = new Set();

  for (const item of classified) {
    const sourceCount = sourceCounts.get(item.source) || 0;
    if (sourceCount >= 1) continue;

    const hint = inferTopicHint(item.title);
    if (hint && topicHints.has(hint)) continue;

    selected.push(item);
    sourceCounts.set(item.source, sourceCount + 1);
    if (hint) topicHints.add(hint);
    if (selected.length === count) break;
  }

  return selected;
}

function buildOnChainMetrics(stablecoinSupply, chains = []) {
  const metrics = [];

  if (Number.isFinite(stablecoinSupply)) {
    metrics.push({
      label: 'Stablecoin Supply',
      value: stablecoinSupply,
      delta: stablecoinSupply >= 300_000_000_000 ? 'Above $300B tracked supply' : 'Tracked across major stables',
      direction: 'up',
    });
  }

  chains.slice(0, 3).forEach((chain, index) => {
    const rank = index + 1;
    const rankLabel = rank === 1 ? 'Largest DeFi base' : `Rank #${rank} by TVL`;
    const ecosystem = chain.tokenSymbol ? `${chain.tokenSymbol} ecosystem` : rankLabel;

    metrics.push({
      label: `${chain.name} TVL`,
      value: chain.tvl,
      delta: index === 0 ? rankLabel : ecosystem,
      direction: index === 0 ? 'up' : 'flat',
    });
  });

  return metrics.slice(0, 4);
}

function buildChartOfTheDay(chains = []) {
  const topChains = chains.slice(0, 5);
  if (topChains.length === 0) return null;

  const maxTvl = Math.max(...topChains.map((chain) => chain.tvl || 0), 1);
  const bars = topChains.map((chain, index) => ({
    name: chain.name,
    tokenSymbol: chain.tokenSymbol,
    tvl: chain.tvl,
    width: Math.max(12, Math.round(((chain.tvl || 0) / maxTvl) * 100)),
    fill: index === 0 ? '#00c896' : index === 1 ? '#0088ff' : 'rgba(255,255,255,0.35)',
  }));

  const [leader, challenger] = topChains;
  const caption = challenger
    ? `<strong>${leader.name}</strong> remains the dominant DeFi base at ${formatCompactCurrency(leader.tvl)}, while <strong>${challenger.name}</strong> is the clear second tier by TVL.`
    : `<strong>${leader.name}</strong> is the largest DeFi base in the tracked chain set at ${formatCompactCurrency(leader.tvl)}.`;

  return {
    title: 'Top Chains by TVL',
    caption,
    source: 'Source: DeFi Llama · TVL by chain',
    bars,
  };
}

function selectPredictions(markets = [], count = 4) {
  const marketsWithMeta = markets
    .map((market) => {
      const endTime = new Date(market.endDate).getTime();
      const daysUntil = Number.isFinite(endTime) ? (endTime - Date.now()) / (24 * 60 * 60 * 1000) : Number.POSITIVE_INFINITY;
      const topic =
        /\bbitcoin\b|\bbtc\b/i.test(market.question) ? 'bitcoin' :
          /\bethereum\b|\beth\b/i.test(market.question) ? 'ethereum' :
            /\bsolana\b|\bsol\b/i.test(market.question) ? 'solana' :
              /megaeth/i.test(market.question) ? 'megaeth' :
                /stablecoin|usdc|usdt/i.test(market.question) ? 'stablecoin' :
                  'other';

      return {
        ...market,
        _daysUntil: daysUntil,
        _topic: topic,
      };
    })
    .filter((market) => market._daysUntil > 0);

  marketsWithMeta.sort((a, b) => {
    const aSoon = a._daysUntil <= 120 ? 0 : 1;
    const bSoon = b._daysUntil <= 120 ? 0 : 1;
    if (aSoon !== bSoon) return aSoon - bSoon;
    if (Math.abs(a._daysUntil - b._daysUntil) > 0.5) return a._daysUntil - b._daysUntil;
    return (b.volume24hr || 0) - (a.volume24hr || 0);
  });

  const selected = [];
  const seenTopics = new Set();
  for (const market of marketsWithMeta) {
    if (seenTopics.has(market._topic) && market._topic !== 'other') continue;
    seenTopics.add(market._topic);
    selected.push(market);
    if (selected.length === count) break;
  }

  return selected.map(({ _daysUntil, _topic, ...market }) => market);
}

function buildMarketNarrative({ prices = [], global = {}, fearGreed, stablecoinSupply }) {
  const bySymbol = Object.fromEntries(prices.map((price) => [price.symbol, price]));
  const movers = [...prices].sort((a, b) => Math.abs(b.change24h || 0) - Math.abs(a.change24h || 0));
  const leadMover = movers[0];
  const tone =
    fearGreed?.score >= 60 ? 'risk-on footing' :
      fearGreed?.score <= 30 ? 'defensive footing' :
        'balanced footing';

  const sentences = [];

  if (Number.isFinite(global.totalMarketCap) || Number.isFinite(global.btcDominance)) {
    const marketCapText = Number.isFinite(global.totalMarketCap)
      ? `<strong>${formatCompactCurrency(global.totalMarketCap)}</strong>`
      : 'the broader market';
    const dominanceText = Number.isFinite(global.btcDominance)
      ? `<strong>${formatPercent(global.btcDominance)}</strong>`
      : 'recent ranges';

    sentences.push(
      `Crypto is trading on <strong>${tone}</strong> with total market cap at ${marketCapText} and BTC dominance holding near ${dominanceText}.`
    );
  }

  if (bySymbol.BTC || bySymbol.ETH || bySymbol.SOL) {
    const moveParts = [bySymbol.BTC, bySymbol.ETH, bySymbol.SOL]
      .filter(Boolean)
      .map((asset) => (
        `<strong>${asset.symbol}</strong> at ${formatCurrency(asset.price, asset.price < 1000 ? 2 : 0)} (${formatSignedPercent(asset.change24h)})`
      ));

    sentences.push(`Among majors, ${moveParts.join(', ')}.`);
  }

  if (leadMover || fearGreed || Number.isFinite(stablecoinSupply)) {
    const moverText = leadMover
      ? `<strong>${leadMover.symbol}</strong> is the largest 24-hour mover at ${formatSignedPercent(leadMover.change24h)}`
      : 'Macro sentiment remains the main driver';
    const sentimentText = fearGreed
      ? `while Fear & Greed sits at <strong>${fearGreed.score} - ${normalizeWhitespace(fearGreed.label)}</strong>`
      : 'while sentiment data is unavailable';
    const stablecoinText = Number.isFinite(stablecoinSupply)
      ? `and tracked stablecoin supply stands near <strong>${formatCompactCurrency(stablecoinSupply)}</strong>`
      : '';

    sentences.push(`${moverText} ${sentimentText} ${stablecoinText}.`.replace(/\s+\./g, '.'));
  }

  return sentences.slice(0, 3).join(' ');
}

export async function aggregateBriefing({ now = new Date() } = {}) {
  const date = formatISODate(now);
  const displayDate = formatDisplayDate(now);
  const issueNumber = computeIssueNumber(date);
  const { values, failures } = await settleSources();

  const rssHeadlines = (values.rss || []).map((item) => ({
    title: normalizeWhitespace(item.title),
    description: truncateText(item.description, 200),
    link: item.link,
    pubDate: item.pubDate,
    source: item.source,
    sourceType: item.sourceType,
  }));

  const curatedRss = rssHeadlines
    .map((item, index) => ({
      ...item,
      _index: index,
      _score: headlineScore(item),
    }))
    .filter((item) => item._score >= 0)
    .sort((a, b) => {
      if (b._score !== a._score) return b._score - a._score;
      return a._index - b._index;
    })
    .map(({ _index, _score, ...item }) => item);

  const deals = selectClassifiedArticles(curatedRss, DEAL_PATTERNS, 4, new Set(), { dedupeTopics: true });
  const regulationSecurity = selectClassifiedArticles(
    curatedRss,
    REG_SECURITY_PATTERNS,
    4,
    new Set(deals.map((item) => item.link))
    ,
    { dedupeTopics: true }
  );
  const excludedHeadlineLinks = new Set([
    ...deals.map((item) => item.link),
    ...regulationSecurity.map((item) => item.link),
  ]);
  const headlines = selectDiverseArticles(curatedRss, 6, 2, excludedHeadlineLinks);
  const deepReads = selectDeepReads(
    curatedRss,
    4,
    new Set([
      ...headlines.map((item) => item.link),
      ...deals.map((item) => item.link),
      ...regulationSecurity.map((item) => item.link),
    ])
  );
  const predictions = selectPredictions(values.predictions || [], 4);
  const onChain = buildOnChainMetrics(values.stablecoinSupply, values.chainTvl || []);
  const chartOfTheDay = buildChartOfTheDay(values.chainTvl || []);
  const kols = (values.kols || []).map((tweet) => ({
    ...tweet,
    quote: truncateText(tweet.quote, 320),
  }));

  return {
    date,
    displayDate,
    issueNumber,
    market: {
      prices: values.prices || [],
      totalMarketCap: values.global?.totalMarketCap ?? null,
      btcDominance: values.global?.btcDominance ?? null,
      fearGreed: values.fearGreed || null,
      narrative: buildMarketNarrative({
        prices: values.prices || [],
        global: values.global || {},
        fearGreed: values.fearGreed || null,
        stablecoinSupply: values.stablecoinSupply,
      }),
    },
    headlines,
    deals,
    deepReads,
    onChain,
    chartOfTheDay,
    regulationSecurity,
    predictions,
    kols,
    meta: {
      fetchedAt: now.toISOString(),
      failures,
      sourceStatus: {
        prices: Boolean(values.prices),
        global: Boolean(values.global),
        fearGreed: Boolean(values.fearGreed),
        stablecoinSupply: Number.isFinite(values.stablecoinSupply),
        chainTvl: Array.isArray(values.chainTvl) && values.chainTvl.length > 0,
        rss: rssHeadlines.length > 0,
        predictions: predictions.length > 0,
        kols: kols.length > 0,
      },
    },
  };
}
