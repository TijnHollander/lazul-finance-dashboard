import { get, writable } from 'svelte/store';
import { fetchQuotes, provider } from './market';
import { holdingOverrides, watchlist } from './stores';

/**
 * Automatisch verversen.
 *  - Koersen: elke 60 s (Vercel) of 120 s (Finnhub, i.v.m. limiet van 60 verzoeken/min)
 *  - Nieuws: elke 5 min (pagina's luisteren naar `newsTick`)
 * Alleen als het tabblad zichtbaar is; bij terugkeren naar het tabblad direct verversen.
 */
export const quoteTick = writable(0);
export const newsTick = writable(0);
export const lastQuoteRefresh = writable<number | null>(null);
export const refreshIntervalSec = writable(60);

const NEWS_MS = 5 * 60_000;
let started = false;
let lastNews = Date.now();

function symbols() {
	const port = Object.values(get(holdingOverrides)).map((o) => o.symbol).filter(Boolean) as string[];
	return [...new Set([...get(watchlist), ...port])];
}

async function refreshQuotes() {
	if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
	const p = await provider();
	if (p === 'none') return;
	await fetchQuotes(symbols(), { maxAgeMs: (get(refreshIntervalSec) - 5) * 1000 });
	lastQuoteRefresh.set(Date.now());
	quoteTick.update((n) => n + 1);
}

function maybeNews(force = false) {
	if (force || Date.now() - lastNews >= NEWS_MS) {
		lastNews = Date.now();
		newsTick.update((n) => n + 1);
	}
}

export async function startAutoRefresh() {
	if (started) return;
	started = true;
	const p = await provider();
	refreshIntervalSec.set(p === 'finnhub' ? 120 : 60);
	await refreshQuotes();
	setInterval(refreshQuotes, get(refreshIntervalSec) * 1000);
	setInterval(() => document.visibilityState === 'visible' && maybeNews(), 30_000);
	document.addEventListener('visibilitychange', () => {
		if (document.visibilityState !== 'visible') return;
		const last = get(lastQuoteRefresh);
		if (!last || Date.now() - last > 30_000) refreshQuotes();
		maybeNews();
	});
}
