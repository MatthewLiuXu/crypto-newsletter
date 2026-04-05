import fetch from 'node-fetch';

export async function fetchStablecoinSupply() {
  const res = await fetch('https://stablecoins.llama.fi/stablecoins?includePrices=true');
  if (!res.ok) throw new Error(`DeFi Llama stablecoins: ${res.status}`);
  const data = await res.json();

  // Sum all peggedUSD circulating
  let total = 0;
  for (const coin of data.peggedAssets || []) {
    total += coin.circulating?.peggedUSD || 0;
  }
  return total;
}

export async function fetchChainTVL() {
  const res = await fetch('https://api.llama.fi/v2/chains');
  if (!res.ok) throw new Error(`DeFi Llama chains: ${res.status}`);
  const chains = await res.json();

  // Return top chains by TVL
  chains.sort((a, b) => (b.tvl || 0) - (a.tvl || 0));
  return chains.slice(0, 10).map(c => ({
    name: c.name,
    tvl: c.tvl,
    tokenSymbol: c.tokenSymbol,
  }));
}
