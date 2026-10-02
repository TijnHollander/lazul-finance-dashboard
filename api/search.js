import { query, send, getJson } from './_lib.js';

/** GET /api/search?q=IE00BK5BQT80  → zoekt tickers op naam, ticker of ISIN */
export default async function handler(req, res) {
	const q = String(query(req).q || '').trim().slice(0, 60);
	if (!q) return send(res, 400, { error: 'Geen zoekterm' });
	try {
		const data = await getJson(
			`https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=10&newsCount=0&listsCount=0&lang=nl-NL&region=NL`
		);
		const results = (data.quotes || [])
			.filter((x) => x.symbol && ['EQUITY', 'ETF', 'MUTUALFUND', 'INDEX', 'CRYPTOCURRENCY', 'CURRENCY', 'FUTURE'].includes(x.quoteType))
			.map((x) => ({ symbol: x.symbol, name: x.longname || x.shortname || x.symbol, exchange: x.exchDisp || x.exchange, type: x.quoteType }));
		send(res, 200, { results }, 86400);
	} catch (e) {
		send(res, 502, { error: String(e.message || e) }, 10);
	}
}
