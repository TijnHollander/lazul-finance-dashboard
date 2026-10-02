import { query, send, getJson, cleanSymbols } from './_lib.js';

/**
 * GET /api/quote?symbols=AAPL,VWRL.AS&range=1mo
 * Haalt koersen op via de publieke Yahoo Finance chart-API (geen sleutel nodig).
 */
export default async function handler(req, res) {
	const q = query(req);
	const symbols = cleanSymbols(q.symbols);
	const range = ['1d', '5d', '1mo', '3mo', '6mo', '1y', '5y', 'max'].includes(q.range) ? q.range : '1mo';
	const interval = range === '1d' ? '5m' : range === '5d' ? '30m' : range === '5y' || range === 'max' ? '1wk' : '1d';
	if (!symbols.length) return send(res, 400, { error: 'Geen symbolen opgegeven' });

	const results = await Promise.all(
		symbols.map(async (symbol) => {
			try {
				const data = await getJson(
					`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}&includePrePost=false`
				);
				const r = data?.chart?.result?.[0];
				if (!r) return { symbol, error: 'niet gevonden' };
				const m = r.meta;
				const rawCloses = r.indicators?.quote?.[0]?.close ?? [];
				const rawTimes = r.timestamp ?? [];
				const keep = rawCloses.map((c, i) => (c != null ? i : -1)).filter((i) => i >= 0);
				const closes = keep.map((i) => rawCloses[i]);
				const times = keep.map((i) => rawTimes[i]);
				const price = m.regularMarketPrice ?? closes.at(-1);
				const prev = range === '1d' ? m.chartPreviousClose ?? m.previousClose : m.previousClose ?? closes.at(-2) ?? m.chartPreviousClose;
				return {
					symbol,
					name: m.longName || m.shortName || symbol,
					currency: m.currency || 'USD',
					exchange: m.fullExchangeName || m.exchangeName,
					price,
					previousClose: prev,
					change: prev ? price - prev : 0,
					changePct: prev ? ((price - prev) / prev) * 100 : 0,
					time: (m.regularMarketTime ?? Math.floor(Date.now() / 1000)) * 1000,
					spark: range === '1mo' ? closes.slice(-120) : closes,
					sparkTimes: (range === '1mo' ? times.slice(-120) : times).map((t) => t * 1000)
				};
			} catch (e) {
				return { symbol, error: String(e.message || e) };
			}
		})
	);
	send(res, 200, { quotes: results, provider: 'yahoo' }, range === '1d' ? 60 : 300);
}
