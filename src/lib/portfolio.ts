import { derived } from 'svelte/store';
import { fxRates, holdingOverrides, portfolioImports, quotes } from './stores';
import { toEur } from './market';
import type { Holding } from './parsers/portfolio';

export interface Position {
	key: string;
	name: string;
	isin?: string;
	ticker?: string;
	symbol?: string;
	brokers: string[];
	quantity: number;
	costEur: number | null;
	priceEur: number | null;
	priceLocal: number | null;
	currency: string;
	priceSource: 'live' | 'handmatig' | 'bestand' | 'geen';
	valueEur: number | null;
	gainEur: number | null;
	gainPct: number | null;
	dayChangePct: number | null;
	dayChangeEur: number | null;
	weight: number;
	realizedEur: number;
	dividendsEur: number;
	spark?: number[];
	hidden: boolean;
}

export interface PortfolioSummary {
	positions: Position[];
	totalValue: number;
	totalCost: number;
	unrealized: number;
	unrealizedPct: number;
	dayChange: number;
	dayChangePct: number;
	cash: number;
	realized: number;
	dividends: number;
	deposits: number;
	withdrawals: number;
	fees: number;
	hasData: boolean;
	missingPrices: number;
}

export const portfolio = derived([portfolioImports, holdingOverrides, quotes, fxRates], ([$imports, $ov, $q, $fx]): PortfolioSummary => {
	const merged = new Map<string, { h: Holding; brokers: Set<string> }>();
	let cash = 0,
		deposits = 0,
		withdrawals = 0,
		fees = 0,
		dividends = 0;
	for (const imp of $imports) {
		cash += imp.cashEur ?? 0;
		deposits += imp.deposits;
		withdrawals += imp.withdrawals;
		fees += imp.fees;
		dividends += imp.dividends;
		for (const h of imp.holdings) {
			const ex = merged.get(h.key);
			if (!ex) merged.set(h.key, { h: { ...h }, brokers: new Set([imp.broker]) });
			else {
				ex.brokers.add(imp.broker);
				const a = ex.h;
				a.quantity += h.quantity;
				a.costEur = a.costEur != null && h.costEur != null ? a.costEur + h.costEur : null;
				a.fileValueEur = a.fileValueEur != null || h.fileValueEur != null ? (a.fileValueEur ?? 0) + (h.fileValueEur ?? 0) : null;
				a.realizedEur += h.realizedEur;
				a.dividendsEur += h.dividendsEur;
				a.lastPrice = h.lastPrice ?? a.lastPrice;
				a.ticker = a.ticker ?? h.ticker;
				a.isin = a.isin ?? h.isin;
			}
		}
	}

	const positions: Position[] = [];
	let missing = 0;
	for (const { h, brokers } of merged.values()) {
		const ov = $ov[h.key] ?? {};
		const symbol = ov.symbol;
		const q = symbol ? $q[symbol] : undefined;
		let priceEur: number | null = null;
		let priceLocal: number | null = null;
		let currency = h.priceCurrency || 'EUR';
		let priceSource: Position['priceSource'] = 'geen';
		let dayChangePct: number | null = null;
		if (ov.manualPrice != null) {
			priceEur = ov.manualPrice;
			priceLocal = ov.manualPrice;
			currency = 'EUR';
			priceSource = 'handmatig';
		} else if (q && isFinite(q.price) && !q.error) {
			priceLocal = q.price;
			currency = q.currency;
			priceEur = toEur(q.price, q.currency, $fx.rates);
			dayChangePct = q.changePct;
			priceSource = priceEur != null ? 'live' : 'geen';
		}
		if (priceEur == null) {
			if (h.fileValueEur != null && h.quantity) {
				priceEur = h.fileValueEur / h.quantity;
				priceLocal = h.lastPrice;
				priceSource = 'bestand';
			} else if (h.lastPrice != null) {
				priceEur = toEur(h.lastPrice, h.priceCurrency, $fx.rates);
				priceLocal = h.lastPrice;
				currency = h.priceCurrency;
				priceSource = priceEur != null ? 'bestand' : 'geen';
			}
		}
		if (priceSource === 'geen' || priceSource === 'bestand') missing += priceSource === 'geen' ? 1 : 0;
		const valueEur = priceEur != null ? priceEur * h.quantity : null;
		const gainEur = valueEur != null && h.costEur != null && h.costEur > 0 ? valueEur - h.costEur : null;
		positions.push({
			key: h.key,
			name: h.name,
			isin: h.isin,
			ticker: h.ticker,
			symbol,
			brokers: [...brokers],
			quantity: h.quantity,
			costEur: h.costEur,
			priceEur,
			priceLocal,
			currency,
			priceSource,
			valueEur,
			gainEur,
			gainPct: gainEur != null && h.costEur ? (gainEur / h.costEur) * 100 : null,
			dayChangePct,
			dayChangeEur: valueEur != null && dayChangePct != null ? valueEur - valueEur / (1 + dayChangePct / 100) : null,
			weight: 0,
			realizedEur: h.realizedEur,
			dividendsEur: h.dividendsEur,
			spark: q?.spark,
			hidden: !!ov.hidden
		});
	}
	const visible = positions.filter((p) => !p.hidden);
	const totalValue = visible.reduce((a, p) => a + (p.valueEur ?? 0), 0);
	for (const p of positions) p.weight = totalValue && p.valueEur ? p.valueEur / totalValue : 0;
	positions.sort((a, b) => (b.valueEur ?? 0) - (a.valueEur ?? 0));
	const withCost = visible.filter((p) => p.costEur != null && p.valueEur != null);
	const totalCost = withCost.reduce((a, p) => a + (p.costEur ?? 0), 0);
	const unrealized = withCost.reduce((a, p) => a + (p.valueEur! - p.costEur!), 0);
	const dayChange = visible.reduce((a, p) => a + (p.dayChangeEur ?? 0), 0);
	return {
		positions,
		totalValue,
		totalCost,
		unrealized,
		unrealizedPct: totalCost ? (unrealized / totalCost) * 100 : 0,
		dayChange,
		dayChangePct: totalValue - dayChange ? (dayChange / (totalValue - dayChange)) * 100 : 0,
		cash,
		realized: visible.reduce((a, p) => a + p.realizedEur, 0),
		dividends,
		deposits,
		withdrawals,
		fees,
		hasData: $imports.length > 0,
		missingPrices: missing
	};
});
