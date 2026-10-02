import { base } from '$app/paths';
import { get } from 'svelte/store';
import { fxRates, quotes, settings, type Quote } from './stores';

/**
 * Marktdata-laag.
 *  1. Gehost op Vercel (of `npm run dev`): eigen /api-functies → Yahoo Finance + RSS, geen sleutel nodig.
 *  2. Statisch gehost (GitHub Pages): direct naar Finnhub met een gratis API-sleutel uit Instellingen.
 *     Let op: het gratis Finnhub-abonnement dekt vooral Amerikaanse aandelen.
 *  Wisselkoersen komen van Frankfurter (ECB-koersen, gratis, geen sleutel).
 */

export type Provider = 'api' | 'finnhub' | 'none';
let providerPromise: Promise<Provider> | null = null;

export function provider(): Promise<Provider> {
	if (!providerPromise) {
		providerPromise = (async () => {
			try {
				const r = await fetch(`${base}/api/health`, { cache: 'no-store' });
				if (r.ok && (r.headers.get('content-type') ?? '').includes('json')) return 'api';
			} catch {
				/* geen backend */
			}
			return get(settings).finnhubKey ? 'finnhub' : 'none';
		})();
	}
	return providerPromise;
}
export function resetProvider() {
	providerPromise = null;
}

const FH = 'https://finnhub.io/api/v1';
async function fh<T>(path: string): Promise<T> {
	const key = get(settings).finnhubKey;
	const r = await fetch(`${FH}${path}${path.includes('?') ? '&' : '?'}token=${encodeURIComponent(key)}`);
	if (!r.ok) throw new Error(`Finnhub ${r.status}`);
	return r.json();
}

/** Koersen ophalen en in de cache zetten. maxAgeMs voorkomt onnodige verzoeken. */
export async function fetchQuotes(symbols: string[], { maxAgeMs = 60_000, range = '1mo' } = {}): Promise<Record<string, Quote>> {
	const cache = get(quotes);
	const now = Date.now();
	const todo = [...new Set(symbols.filter(Boolean))].filter((s) => !cache[s] || now - cache[s].fetchedAt > maxAgeMs);
	if (!todo.length) return cache;
	const p = await provider();
	const fresh: Record<string, Quote> = {};
	if (p === 'api') {
		for (let i = 0; i < todo.length; i += 25) {
			const chunk = todo.slice(i, i + 25);
			try {
				const r = await fetch(`${base}/api/quote?symbols=${encodeURIComponent(chunk.join(','))}&range=${range}`);
				const j = await r.json();
				for (const q of j.quotes ?? []) {
					if (q.error || q.price == null) fresh[q.symbol] = { ...(cache[q.symbol] ?? emptyQuote(q.symbol)), error: q.error ?? 'geen koers', fetchedAt: now };
					else fresh[q.symbol] = { ...q, fetchedAt: now };
				}
			} catch (e) {
				console.warn('quote', e);
			}
		}
	} else if (p === 'finnhub') {
		await Promise.all(
			todo.map(async (symbol) => {
				try {
					const q = await fh<{ c: number; d: number; dp: number; pc: number; t: number }>(`/quote?symbol=${encodeURIComponent(symbol)}`);
					if (!q.c) throw new Error('niet beschikbaar in gratis Finnhub');
					fresh[symbol] = {
						symbol,
						currency: guessCurrency(symbol),
						price: q.c,
						previousClose: q.pc,
						change: q.d ?? 0,
						changePct: q.dp ?? 0,
						time: (q.t || now / 1000) * 1000,
						fetchedAt: now
					};
				} catch (e) {
					fresh[symbol] = { ...(cache[symbol] ?? emptyQuote(symbol)), error: String((e as Error).message), fetchedAt: now };
				}
			})
		);
	}
	quotes.update((c) => ({ ...c, ...fresh }));
	return get(quotes);
}

function emptyQuote(symbol: string): Quote {
	return { symbol, currency: 'EUR', price: NaN, change: 0, changePct: 0, time: 0, fetchedAt: 0 };
}

function guessCurrency(symbol: string): string {
	if (/\.(AS|DE|PA|MI|MC|BR|LS|F|VI|HE|IR)$/.test(symbol)) return 'EUR';
	if (/\.L$/.test(symbol)) return 'GBp';
	if (/\.SW$/.test(symbol)) return 'CHF';
	return 'USD';
}

export interface SearchResult {
	symbol: string;
	name: string;
	exchange?: string;
	type?: string;
}

export async function searchSymbol(q: string): Promise<SearchResult[]> {
	const p = await provider();
	try {
		if (p === 'api') {
			const r = await fetch(`${base}/api/search?q=${encodeURIComponent(q)}`);
			return (await r.json()).results ?? [];
		}
		if (p === 'finnhub') {
			const j = await fh<{ result: { symbol: string; description: string; type: string; displaySymbol: string }[] }>(`/search?q=${encodeURIComponent(q)}`);
			return (j.result ?? []).slice(0, 10).map((x) => ({ symbol: x.symbol, name: x.description, type: x.type }));
		}
	} catch (e) {
		console.warn('search', e);
	}
	return [];
}

/** Kies bij een ISIN het meest logische beurssymbool (euro-notering voor ETF's, thuisbeurs voor aandelen). */
export async function resolveSymbol(isin: string | undefined, ticker: string | undefined, name: string): Promise<string | null> {
	const tries = [isin, ticker, name].filter(Boolean) as string[];
	for (const t of tries) {
		const res = await searchSymbol(t);
		if (!res.length) continue;
		const pref = (s: SearchResult) => {
			const sym = s.symbol;
			if (isin?.startsWith('US') && !sym.includes('.')) return 0;
			if (isin?.startsWith('NL') && sym.endsWith('.AS')) return 0;
			if (isin?.startsWith('DE') && (sym.endsWith('.DE') || sym.endsWith('.F'))) return 0;
			if (sym.endsWith('.AS')) return 1;
			if (sym.endsWith('.DE')) return 2;
			if (/\.(PA|MI|BR)$/.test(sym)) return 3;
			if (!sym.includes('.')) return 4;
			return 5;
		};
		return [...res].sort((a, b) => pref(a) - pref(b))[0].symbol;
	}
	return null;
}

// ─── wisselkoersen
export async function fetchFx(): Promise<Record<string, number>> {
	const cur = get(fxRates);
	if (Date.now() - cur.fetchedAt < 6 * 3600_000 && Object.keys(cur.rates).length > 3) return cur.rates;
	for (const url of ['https://api.frankfurter.dev/v1/latest?base=EUR', 'https://api.frankfurter.app/latest?from=EUR']) {
		try {
			const r = await fetch(url);
			if (!r.ok) continue;
			const j = await r.json();
			const rates = { EUR: 1, ...j.rates };
			fxRates.set({ rates, fetchedAt: Date.now() });
			return rates;
		} catch {
			/* volgende proberen */
		}
	}
	return cur.rates;
}

/** Zet een bedrag in vreemde valuta om naar EUR (GBp = Britse pence). */
export function toEur(amount: number, currency: string, rates: Record<string, number>): number | null {
	if (!currency || currency === 'EUR') return amount;
	if (currency === 'GBp' || currency === 'GBX') {
		const r = rates.GBP;
		return r ? amount / 100 / r : null;
	}
	const r = rates[currency.toUpperCase()];
	return r ? amount / r : null;
}

// ─── nieuws
export interface NewsItem {
	title: string;
	link: string;
	summary: string;
	published: number;
	image: string | null;
	source: string;
	lang?: string;
	scope?: string;
	symbols: string[];
}

export async function fetchNews(symbols: string[]): Promise<{ items: NewsItem[]; provider: Provider }> {
	const p = await provider();
	if (p === 'api') {
		const r = await fetch(`${base}/api/news?symbols=${encodeURIComponent(symbols.slice(0, 10).join(','))}`);
		const j = await r.json();
		return { items: j.items ?? [], provider: p };
	}
	if (p === 'finnhub') {
		const items: NewsItem[] = [];
		const general = await fh<{ headline: string; url: string; summary: string; datetime: number; image: string; source: string }[]>('/news?category=general');
		for (const n of general.slice(0, 60))
			items.push({ title: n.headline, link: n.url, summary: n.summary, published: n.datetime * 1000, image: n.image || null, source: n.source, scope: 'algemeen', symbols: [] });
		const to = new Date().toISOString().slice(0, 10);
		const from = new Date(Date.now() - 7 * 86400_000).toISOString().slice(0, 10);
		const us = symbols.filter((s) => !s.includes('.') && !s.startsWith('^')).slice(0, 8);
		await Promise.all(
			us.map(async (s) => {
				try {
					const list = await fh<typeof general>(`/company-news?symbol=${s}&from=${from}&to=${to}`);
					for (const n of list.slice(0, 8))
						items.push({ title: n.headline, link: n.url, summary: n.summary, published: n.datetime * 1000, image: n.image || null, source: n.source, scope: 'portfolio', symbols: [s] });
				} catch {
					/* skip */
				}
			})
		);
		return { items: items.sort((a, b) => b.published - a.published), provider: p };
	}
	return { items: [], provider: p };
}

/** Markeer belangrijk nieuws: macro (rente, inflatie, centrale banken) of over je eigen posities. */
const IMPORTANT = /\b(ecb|fed|federal reserve|rente|interest rate|rate cut|rate hike|inflatie|inflation|cpi|recessie|recession|bbp|gdp|werkloosheid|unemployment|jobs report|payrolls|kwartaalcijfers|earnings|winstwaarschuwing|profit warning|crash|beurskrach|tarief|tariff|importheffing|sanctie|overname|takeover|acquisition|faillissement|bankrupt|dnb|afm|box 3|belastingplan|prinsjesdag|olieprijs|oil price|opec)\b/i;
export function isImportant(n: NewsItem): boolean {
	return n.symbols.length > 0 || IMPORTANT.test(n.title);
}

/** Koershistorie voor een grafiek (alleen via de eigen /api; Finnhub-candles zijn niet gratis). */
export async function fetchHistory(symbol: string, range: string): Promise<{ times: number[]; closes: number[]; currency: string; name?: string } | null> {
	if ((await provider()) !== 'api') return null;
	try {
		const r = await fetch(`${base}/api/quote?symbols=${encodeURIComponent(symbol)}&range=${range}`);
		const q = (await r.json()).quotes?.[0];
		if (!q || q.error) return null;
		return { times: q.sparkTimes ?? [], closes: q.spark ?? [], currency: q.currency, name: q.name };
	} catch {
		return null;
	}
}
