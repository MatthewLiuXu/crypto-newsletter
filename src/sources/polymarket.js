import fetch from 'node-fetch';

const CRYPTO_MARKET_PATTERNS = [
  /\bbitcoin\b|\bbtc\b/i,
  /\bethereum\b|\beth\b/i,
  /\bsolana\b|\bsol\b/i,
  /\bcrypto\b|\bstablecoin\b|\busdc\b|\busdt\b|\bdefi\b|\btoken\b/i,
  /\bcoinbase\b|\betf\b|\bairdrop\b|\bfdv\b|\bmainnet\b|\blaunch\b/i,
];

function parseJsonArray(value) {
  try {
    return JSON.parse(value || '[]');
  } catch {
    return [];
  }
}

export async function fetchPolymarketOdds(limit = 4) {
  const pageLimit = 500;
  const offsets = [0, 500, 1000];
  const pages = await Promise.all(offsets.map(async (offset) => {
    const res = await fetch(
      `https://gamma-api.polymarket.com/markets?active=true&closed=false&limit=${pageLimit}&offset=${offset}`
    );
    if (!res.ok) throw new Error(`Polymarket: ${res.status}`);
    return res.json();
  }));
  const markets = pages.flat();

  return markets
    .filter((market) => {
      if (!market?.active || market.closed || market.archived) return false;
      if (!market.endDate) return true;
      return new Date(market.endDate).getTime() > Date.now();
    })
    .filter((market) => CRYPTO_MARKET_PATTERNS.some((pattern) => pattern.test(market.question || '')))
    .map((m) => {
      const prices = parseJsonArray(m.outcomePrices);
      const yesPrice = parseFloat(prices[0] || 0);
      const probability = Math.max(1, Math.min(99, Math.round(yesPrice * 100)));

      return {
        question: m.question,
        probability,
        platform: 'Polymarket',
        endDate: m.endDate,
        volume24hr: Number(m.volume24hr) || 0,
      };
    })
    .filter((market) => Number.isFinite(market.probability))
    .sort((a, b) => (b.volume24hr || 0) - (a.volume24hr || 0))
    .slice(0, limit * 3);
}
