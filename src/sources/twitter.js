import fetch from 'node-fetch';

const API_KEY = process.env.GETXAPI_KEY || 'get-x-api-3073303f437bdaffeae239ebb37bed43c13444af08275f71';
const BASE = 'https://api.getxapi.com';
const DEFAULT_MAX_KOL_CALLS = Number(process.env.GETXAPI_MAX_KOL_CALLS || 7);
const DEFAULT_MIN_KOL_CALLS = Number(process.env.GETXAPI_MIN_KOL_CALLS || 5);

const headers = { Authorization: `Bearer ${API_KEY}` };

export const KOL_LIST = [
  { handle: 'zachxbt', name: 'ZachXBT', category: 'on-chain' },
  { handle: 'MustStopMurad', name: 'Murad', category: 'macro' },
  { handle: 'DefiIgnas', name: 'Ignas', category: 'defi' },
  { handle: 'CryptoCred', name: 'CryptoCred', category: 'ta' },
  { handle: 'lookonchain', name: 'Lookonchain', category: 'on-chain' },
  { handle: 'WuBlockchain', name: 'Wu Blockchain', category: 'news' },
  { handle: 'tier10k', name: 'Tier10K', category: 'news' },
  { handle: 'nic__carter', name: 'Nic Carter', category: 'macro' },
  { handle: 'Rewkang', name: 'Andrew Kang', category: 'vc' },
  { handle: 'HsakaTrades', name: 'Hsaka', category: 'trader' },
  { handle: 'coaborosdotcom', name: 'Cobie', category: 'trader' },
  { handle: 'EmberCN', name: 'Ember', category: 'on-chain' },
];

function formatCount(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(n);
}

function cleanTweetText(text) {
  const stripped = String(text || '')
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return stripped || String(text || '').trim();
}

function tweetToKOL(tweet, kolMeta) {
  return {
    name: kolMeta?.name || tweet.author?.name || tweet.author?.userName,
    handle: tweet.author?.userName,
    avatarInitial: (kolMeta?.name || tweet.author?.name || '?')[0].toUpperCase(),
    quote: cleanTweetText(tweet.text),
    likes: formatCount(tweet.likeCount || 0),
    retweets: formatCount(tweet.retweetCount || 0),
    views: formatCount(tweet.viewCount || 0),
    tweetUrl: tweet.url,
    tweetId: tweet.id,
  };
}

export async function fetchKOLTweets(maxKOLs = 5) {
  const maxCalls = Math.min(KOL_LIST.length, Math.max(maxKOLs, DEFAULT_MAX_KOL_CALLS));
  const minCalls = Math.min(maxCalls, Math.max(1, DEFAULT_MIN_KOL_CALLS));
  const results = [];
  const recentTweets = [];

  for (const kol of KOL_LIST.slice(0, maxCalls)) {
    try {
      const res = await fetch(`${BASE}/twitter/user/tweets?userName=${kol.handle}`, { headers });
      if (!res.ok) {
        let detail = '';
        try {
          const payload = await res.json();
          detail = payload?.error || payload?.message || '';
        } catch {
          detail = '';
        }

        results.push({
          kol,
          tweets: [],
          error: `GetXAPI ${res.status}${detail ? `: ${detail}` : ''}`,
        });
        continue;
      }

      const data = await res.json();
      const tweets = data.tweets || [];

      // Filter to original tweets only (no replies), from last 48 hours
      const cutoff = Date.now() - 48 * 60 * 60 * 1000;
      const filteredTweets = tweets
        .filter(t => !t.isReply && new Date(t.createdAt).getTime() > cutoff)
        .map(t => ({ ...t, _kolMeta: kol }));

      results.push({
        kol,
        tweets: filteredTweets,
        error: null,
      });
      recentTweets.push(...filteredTweets);

      if (results.length >= minCalls && recentTweets.length >= maxKOLs) {
        break;
      }
    } catch {
      results.push({
        kol,
        tweets: [],
        error: 'GetXAPI request failed',
      });
    }
  }

  const allTweets = results.flatMap((result) => result.tweets);
  const errors = results.filter((result) => result.error);

  if (allTweets.length === 0 && errors.length > 0) {
    const creditError = errors.find((result) => result.error.includes('402'));
    if (creditError) {
      throw new Error(creditError.error);
    }

    throw new Error(errors.map((result) => `${result.kol.handle}: ${result.error}`).join('; '));
  }

  // Sort by engagement (likes) and take top N
  allTweets.sort((a, b) => (b.likeCount || 0) - (a.likeCount || 0));
  const top = allTweets.slice(0, maxKOLs);

  return top.map(t => tweetToKOL(t, t._kolMeta));
}

export async function searchTweets(query, count = 20) {
  const res = await fetch(
    `${BASE}/twitter/tweet/advanced_search?q=${encodeURIComponent(query)}&product=Latest`,
    { headers }
  );
  if (!res.ok) throw new Error(`GetXAPI search: ${res.status}`);
  const data = await res.json();
  return data.tweets || [];
}
