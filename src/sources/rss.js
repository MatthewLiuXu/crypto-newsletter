import fetch from 'node-fetch';
import { XMLParser } from 'fast-xml-parser';

const parser = new XMLParser({ ignoreAttributes: false });

const FEEDS = [
  { url: 'https://cointelegraph.com/rss', source: 'CoinTelegraph' },
  { url: 'https://decrypt.co/feed', source: 'Decrypt' },
  { url: 'https://www.coindesk.com/arc/outboundfeeds/rss/', source: 'CoinDesk' },
  { url: 'https://blockworks.co/feed', source: 'Blockworks' },
  { url: 'https://bitcoinmagazine.com/.rss/full/', source: 'Bitcoin Magazine' },
  { url: 'https://www.theblock.co/rss.xml', source: 'The Block' },
];

function stripHtml(str) {
  return String(str || '')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&#039;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .trim();
}

function toArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function pickText(value) {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (!value || typeof value !== 'object') return '';
  if (typeof value['#text'] === 'string') return value['#text'];
  return '';
}

function pickLink(value) {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    const alternate = value.find((entry) => entry?.['@_rel'] === 'alternate' && entry?.['@_href']);
    if (alternate) return alternate['@_href'];
    const firstHref = value.find((entry) => entry?.['@_href']);
    if (firstHref) return firstHref['@_href'];
    return pickLink(value[0]);
  }
  if (!value || typeof value !== 'object') return '';
  return value['@_href'] || value['#text'] || '';
}

function parseRssItems(items, sourceName) {
  return toArray(items).map((item) => ({
    title: stripHtml(pickText(item.title)),
    description: stripHtml(pickText(item.description) || pickText(item['content:encoded'])),
    link: pickLink(item.link) || pickText(item.guid),
    pubDate: item.pubDate || item['atom:updated'] || '',
    source: sourceName,
    sourceType: 'publication',
  }));
}

function parseAtomEntries(entries, sourceName) {
  return toArray(entries).map((entry) => ({
    title: stripHtml(pickText(entry.title)),
    description: stripHtml(pickText(entry.summary) || pickText(entry.content)),
    link: pickLink(entry.link) || pickText(entry.id),
    pubDate: entry.published || entry.updated || '',
    source: sourceName,
    sourceType: 'publication',
  }));
}

async function parseFeed(feedUrl, sourceName) {
  const res = await fetch(feedUrl);
  if (!res.ok) return [];
  const xml = await res.text();
  const parsed = parser.parse(xml);
  const rssItems = parsed?.rss?.channel?.item;
  const atomEntries = parsed?.feed?.entry;

  const items = rssItems ? parseRssItems(rssItems, sourceName) : parseAtomEntries(atomEntries, sourceName);
  return items
    .filter((item) => item.title && item.link)
    .slice(0, 15);
}

export async function fetchRSSHeadlines() {
  const promises = FEEDS.map(f => parseFeed(f.url, f.source));
  const results = await Promise.all(promises);
  const all = results.flat();

  // Sort by date descending
  all.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
  return all.slice(0, 60);
}
