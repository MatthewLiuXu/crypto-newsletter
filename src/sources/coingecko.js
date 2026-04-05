import fetch from 'node-fetch';

const API_KEY = process.env.COINGECKO_API_KEY || 'CG-yw2k7g6FzYQMtu3SJGhxS5WZ';
const BASE = 'https://api.coingecko.com/api/v3';

export async function fetchPrices() {
  const url = `${BASE}/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd&include_24hr_change=true&include_market_cap=true&x_cg_demo_api_key=${API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`CoinGecko prices: ${res.status}`);
  const data = await res.json();

  const map = { bitcoin: 'BTC', ethereum: 'ETH', solana: 'SOL' };
  return Object.entries(map).map(([id, symbol]) => {
    const d = data[id];
    const change = d.usd_24h_change;
    return {
      symbol,
      price: d.usd,
      change24h: change,
      direction: Math.abs(change) < 0.5 ? 'flat' : change > 0 ? 'up' : 'down',
    };
  });
}

export async function fetchGlobal() {
  const url = `${BASE}/global?x_cg_demo_api_key=${API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`CoinGecko global: ${res.status}`);
  const { data } = await res.json();

  return {
    totalMarketCap: data.total_market_cap.usd,
    btcDominance: data.market_cap_percentage.btc,
  };
}
