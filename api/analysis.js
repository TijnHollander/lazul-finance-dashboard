import { query, send, UA } from './_lib.js';

/**
 * GET /api/analysis?symbol=AAPL
 * Bedrijfsdata voor de analyse onder de grafiek:
 *  - Yahoo quoteSummary (analisten, K/W, marges, profiel)  → vereist cookie + "crumb"
 *  - Yahoo fundamentals-timeseries (jaarcijfers omzet, EPS, marges, aandelen)
 */

let session = null; // { cookie, crumb, at } — hergebruikt zolang de functie warm is

async function getSession(force = false) {
	if (!force && session && Date.now() - session.at < 30 * 60_000) return session;
	const r = await fetch('https://fc.yahoo.com/', { headers: { 'User-Agent': UA }, redirect: 'manual' });
	const setCookies = typeof r.headers.getSetCookie === 'function' ? r.headers.getSetCookie() : [r.headers.get('set-cookie') ?? ''];
	const cookie = setCookies.map((c) => c.split(';')[0]).filter(Boolean).join('; ');
	const c = await fetch('https://query1.finance.yahoo.com/v1/test/getcrumb', { headers: { 'User-Agent': UA, Cookie: cookie } });
	const crumb = (await c.text()).trim();
	if (!c.ok || !crumb || crumb.includes('<') || crumb.length > 40) throw new Error('crumb niet beschikbaar');
	session = { cookie, crumb, at: Date.now() };
	return session;
}

const MODULES = ['price', 'financialData', 'defaultKeyStatistics', 'summaryDetail', 'recommendationTrend', 'assetProfile', 'earningsTrend', 'quoteType'];

async function quoteSummary(symbol) {
	for (let attempt = 0; attempt < 2; attempt++) {
		const s = await getSession(attempt > 0);
		const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=${MODULES.join(',')}&crumb=${encodeURIComponent(s.crumb)}`;
		const r = await fetch(url, { headers: { 'User-Agent': UA, Cookie: s.cookie, Accept: 'application/json' } });
		if (r.status === 401 || r.status === 403) continue;
		const j = await r.json();
		const res = j?.quoteSummary?.result?.[0];
		if (res) return res;
		throw new Error(j?.quoteSummary?.error?.description || 'geen data');
	}
	throw new Error('Yahoo weigert de aanvraag');
}

const TS_TYPES = [
	'annualTotalRevenue',
	'annualDilutedEPS',
	'annualNetIncome',
	'annualOperatingIncome',
	'annualGrossProfit',
	'annualResearchAndDevelopment',
	'annualDilutedAverageShares',
	'annualFreeCashFlow'
];

async function timeseries(symbol) {
	const now = Math.floor(Date.now() / 1000);
	const from = now - 8 * 365 * 86400;
	const url = `https://query2.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries/${encodeURIComponent(symbol)}?type=${TS_TYPES.join(',')}&period1=${from}&period2=${now}&merge=false`;
	const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
	if (!r.ok) throw new Error(`timeseries ${r.status}`);
	const j = await r.json();
	const out = {};
	for (const item of j?.timeseries?.result ?? []) {
		const type = item?.meta?.type?.[0];
		if (!type || !Array.isArray(item[type])) continue;
		out[type] = item[type]
			.filter((x) => x && x.asOfDate && x.reportedValue && typeof x.reportedValue.raw === 'number')
			.map((x) => ({ date: x.asOfDate, value: x.reportedValue.raw }));
	}
	return out;
}

const raw = (o) => (o && typeof o === 'object' && 'raw' in o ? o.raw : typeof o === 'number' ? o : null);

/** Zet de Yahoo-antwoorden om naar het vaste formaat dat de app gebruikt. */
export function normalize(symbol, qs, ts) {
	const fd = qs?.financialData ?? {};
	const ks = qs?.defaultKeyStatistics ?? {};
	const sd = qs?.summaryDetail ?? {};
	const pr = qs?.price ?? {};
	const ap = qs?.assetProfile ?? {};
	const qt = qs?.quoteType ?? {};
	const trend = qs?.recommendationTrend?.trend?.find((t) => t.period === '0m') ?? qs?.recommendationTrend?.trend?.[0];
	const est5y = qs?.earningsTrend?.trend?.find((t) => t.period === '+5y');
	const nextY = qs?.earningsTrend?.trend?.find((t) => t.period === '+1y');

	// jaarreeksen uitlijnen op jaartal
	const years = [...new Set(Object.values(ts ?? {}).flat().map((x) => x.date.slice(0, 4)))].sort();
	const series = (type) => years.map((y) => ts?.[type]?.find((x) => x.date.startsWith(y))?.value ?? null);

	const quoteTypeStr = String(qt.quoteType || pr.quoteType || '').toUpperCase();
	return {
		symbol,
		name: pr.longName || pr.shortName || qt.longName || symbol,
		type: quoteTypeStr === 'EQUITY' ? 'equity' : quoteTypeStr === 'ETF' || quoteTypeStr === 'MUTUALFUND' ? 'etf' : quoteTypeStr ? 'other' : 'equity',
		currency: pr.currency || fd.financialCurrency || 'USD',
		price: raw(fd.currentPrice) ?? raw(pr.regularMarketPrice),
		sector: ap.sector ?? null,
		industry: ap.industry ?? null,
		summary: ap.longBusinessSummary ?? null,
		website: ap.website ?? null,
		employees: ap.fullTimeEmployees ?? null,
		country: ap.country ?? null,
		analyst: trend || raw(fd.numberOfAnalystOpinions)
			? {
					count: raw(fd.numberOfAnalystOpinions),
					strongBuy: trend?.strongBuy ?? 0,
					buy: trend?.buy ?? 0,
					hold: trend?.hold ?? 0,
					sell: trend?.sell ?? 0,
					strongSell: trend?.strongSell ?? 0,
					mean: raw(fd.recommendationMean),
					key: fd.recommendationKey ?? null,
					targetMean: raw(fd.targetMeanPrice),
					targetHigh: raw(fd.targetHighPrice),
					targetLow: raw(fd.targetLowPrice)
				}
			: null,
		valuation: {
			trailingPE: raw(sd.trailingPE) ?? raw(ks.trailingPE),
			forwardPE: raw(sd.forwardPE) ?? raw(ks.forwardPE),
			peg: raw(ks.pegRatio),
			priceToSales: raw(sd.priceToSalesTrailing12Months),
			marketCap: raw(sd.marketCap) ?? raw(pr.marketCap),
			beta: raw(sd.beta),
			dividendYield: raw(sd.dividendYield),
			trailingEps: raw(ks.trailingEps),
			forwardEps: raw(ks.forwardEps)
		},
		margins: {
			gross: raw(fd.grossMargins),
			operating: raw(fd.operatingMargins),
			net: raw(fd.profitMargins),
			roe: raw(fd.returnOnEquity)
		},
		balance: {
			cash: raw(fd.totalCash),
			debt: raw(fd.totalDebt),
			debtToEquity: raw(fd.debtToEquity),
			freeCashflow: raw(fd.freeCashflow)
		},
		growth: {
			revenueYoY: raw(fd.revenueGrowth),
			earningsYoY: raw(fd.earningsGrowth),
			analyst5y: raw(est5y?.growth),
			nextYearEps: raw(nextY?.growth)
		},
		history: {
			years,
			revenue: series('annualTotalRevenue'),
			eps: series('annualDilutedEPS'),
			netIncome: series('annualNetIncome'),
			operatingIncome: series('annualOperatingIncome'),
			grossProfit: series('annualGrossProfit'),
			rd: series('annualResearchAndDevelopment'),
			shares: series('annualDilutedAverageShares'),
			fcf: series('annualFreeCashFlow')
		},
		source: 'Yahoo Finance',
		fetchedAt: Date.now()
	};
}

export default async function handler(req, res) {
	const symbol = String(query(req).symbol || '').trim().toUpperCase();
	if (!/^[A-Z0-9.^=\-]{1,20}$/.test(symbol)) return send(res, 400, { error: 'Ongeldig symbool' });
	const [qs, ts] = await Promise.allSettled([quoteSummary(symbol), timeseries(symbol)]);
	if (qs.status === 'rejected' && ts.status === 'rejected') {
		return send(res, 502, { error: 'Geen fundamentele data beschikbaar', details: [String(qs.reason), String(ts.reason)] }, 30);
	}
	const data = normalize(symbol, qs.status === 'fulfilled' ? qs.value : null, ts.status === 'fulfilled' ? ts.value : null);
	data.partial = qs.status === 'rejected' ? 'analisten- en waarderingsdata niet beschikbaar' : ts.status === 'rejected' ? 'jaarcijfers niet beschikbaar' : null;
	send(res, 200, data, 3600);
}
