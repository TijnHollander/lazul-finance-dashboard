import { derived, writable } from 'svelte/store';
import { persisted } from './storage';
import type { PortfolioImport } from './parsers/portfolio';
import type { BankTx } from './parsers/bank';
import type { CategoryRules } from './cashflow';
import type { RapportData } from './report';

// ─── profiel & sessie
export interface Profile {
	name: string;
	birthYear: number | null;
	pinHash: string | null; // SHA-256 van pincode, alleen lokaal
	createdAt: string;
}
export const profile = persisted<Profile | null>('profile', null);
export const unlocked = writable<boolean>(typeof sessionStorage !== 'undefined' && sessionStorage.getItem('lazul:unlocked') === '1');
unlocked.subscribe((v) => {
	try {
		if (v) sessionStorage.setItem('lazul:unlocked', '1');
		else sessionStorage.removeItem('lazul:unlocked');
	} catch {
		/* ignore */
	}
});

// ─── instellingen
export interface Settings {
	finnhubKey: string;
	expectedReturn: number; // verwacht jaarrendement beleggen (%)
	savingsRate: number; // spaarrente (%)
	inflation: number; // (%)
	hideAmounts: boolean;
}
export const settings = persisted<Settings>('settings', {
	finnhubKey: '',
	expectedReturn: 6,
	savingsRate: 2,
	inflation: 2.5,
	hideAmounts: false
});

// ─── portfolio
export const portfolioImports = persisted<PortfolioImport[]>('portfolio', []);
export interface HoldingOverride {
	symbol?: string; // Yahoo/Finnhub-symbool
	manualPrice?: number; // in EUR
	hidden?: boolean;
}
export const holdingOverrides = persisted<Record<string, HoldingOverride>>('holdingOverrides', {});

// ─── koersen
export interface Quote {
	symbol: string;
	name?: string;
	currency: string;
	exchange?: string;
	price: number;
	previousClose?: number;
	change: number;
	changePct: number;
	time: number;
	spark?: number[];
	fetchedAt: number;
	error?: string;
}
export const quotes = persisted<Record<string, Quote>>('quotes', {});
export const fxRates = persisted<{ rates: Record<string, number>; fetchedAt: number }>('fx', { rates: { EUR: 1 }, fetchedAt: 0 });
export const watchlist = persisted<string[]>('watchlist', ['^AEX', '^GSPC', 'IWDA.AS', 'VWRL.AS', 'ASML.AS', 'AAPL', 'NVDA', 'MSFT', 'BTC-EUR', 'EURUSD=X']);

// ─── uitgaven / inkomsten
export const bankTx = persisted<BankTx[]>('bankTx', []);
export const categoryRules = persisted<CategoryRules>('categoryRules', {});
export const cashflowOptions = persisted<{ includePartial: boolean; months: number }>('cashflowOptions', { includePartial: false, months: 12 });

// ─── rapport
export const rapport = persisted<{ data: RapportData | null; savedAt: string | null }>('rapport', { data: null, savedAt: null });

// ─── afgeleid: leeftijd
export const age = derived([profile, rapport], ([$p, $r]) => {
	const by = $r.data?.geboortejaar ?? $p?.birthYear;
	return by ? new Date().getFullYear() - by : null;
});

// ─── eigen oordeel per aandeel (analyse onder de grafiek)
export interface TickerNote {
	voordeel: 'ja' | 'twijfel' | 'nee' | null;
	sticky: 'ja' | 'twijfel' | 'nee' | null;
	tienx: 'ja' | 'twijfel' | 'nee' | null;
	notitie: string;
	growth?: number; // eigen groeiaanname
	exitPE?: number;
}
export const tickerNotes = persisted<Record<string, TickerNote>>('tickerNotes', {});
