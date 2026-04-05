import fetch from 'node-fetch';

export async function fetchFearGreed() {
  const res = await fetch('https://api.alternative.me/fng/?limit=1');
  if (!res.ok) throw new Error(`Fear & Greed: ${res.status}`);
  const json = await res.json();
  const entry = json.data[0];
  return {
    score: parseInt(entry.value, 10),
    label: entry.value_classification,
  };
}
