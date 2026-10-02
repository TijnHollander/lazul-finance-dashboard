import { query, send, getText, cleanSymbols } from './_lib.js';

/**
 * GET /api/news?symbols=AAPL,ASML.AS
 * Combineert RSS-feeds: NOS Economie, CNBC Markets, Yahoo Finance (per ticker uit je portfolio).
 */
const FEEDS = [
	{ url: 'https://feeds.nos.nl/nosnieuwseconomie', source: 'NOS Economie', lang: 'nl', scope: 'algemeen' },
	{ url: 'https://www.cnbc.com/id/20910258/device/rss/rss.html', source: 'CNBC Economy', lang: 'en', scope: 'algemeen' },
	{ url: 'https://www.cnbc.com/id/10000664/device/rss/rss.html', source: 'CNBC Markets', lang: 'en', scope: 'algemeen' },
	{ url: 'https://feeds.finance.yahoo.com/rss/2.0/headline?s=%5EGSPC,%5EAEX&region=US&lang=en-US', source: 'Yahoo Finance', lang: 'en', scope: 'algemeen' }
];

function decode(s) {
	return String(s || '')
		.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;|&apos;/g, "'")
		.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
		.replace(/&amp;/g, '&')
		.replace(/<[^>]+>/g, '')
		.replace(/\s+/g, ' ')
		.trim();
}

function tag(xml, name) {
	const m = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i'));
	return m ? m[1] : '';
}

export function parseRss(xml, source, extra = {}) {
	const items = xml.match(/<item[\s\S]*?<\/item>/gi) || [];
	return items.slice(0, 25).map((it) => {
		const enclosure = it.match(/<(?:enclosure|media:content|media:thumbnail)[^>]*url="([^"]+)"/i);
		return {
			title: decode(tag(it, 'title')),
			link: decode(tag(it, 'link')) || decode(tag(it, 'guid')),
			summary: decode(tag(it, 'description')).slice(0, 280),
			published: new Date(decode(tag(it, 'pubDate')) || Date.now()).getTime(),
			image: enclosure ? enclosure[1] : null,
			source,
			...extra
		};
	});
}

export default async function handler(req, res) {
	const symbols = cleanSymbols(query(req).symbols, 10);
	const feeds = [
		...FEEDS,
		...symbols.map((s) => ({
			url: `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${encodeURIComponent(s)}&region=US&lang=en-US`,
			source: 'Yahoo Finance',
			lang: 'en',
			scope: 'portfolio',
			symbol: s
		}))
	];
	const all = await Promise.allSettled(
		feeds.map(async (f) => parseRss(await getText(f.url), f.source, { lang: f.lang, scope: f.scope, symbols: f.symbol ? [f.symbol] : [] }))
	);
	const seen = new Map();
	for (const r of all) {
		if (r.status !== 'fulfilled') continue;
		for (const item of r.value) {
			if (!item.title || !item.link) continue;
			const k = item.link.split('?')[0];
			const prev = seen.get(k);
			if (prev) prev.symbols = [...new Set([...prev.symbols, ...item.symbols])];
			else seen.set(k, item);
		}
	}
	const items = [...seen.values()].sort((a, b) => b.published - a.published).slice(0, 150);
	send(res, 200, { items, provider: 'rss', failed: all.filter((r) => r.status === 'rejected').length }, 300);
}
