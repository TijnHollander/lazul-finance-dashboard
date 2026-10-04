import { base } from '$app/paths';
import { get } from 'svelte/store';
import { settings } from './stores';
import { provider } from './market';

/**
 * Fundamentele analyse van een aandeel.
 * Data: eigen /api/analysis (Yahoo Finance) of — op GitHub Pages — Finnhub (gratis, beperkter).
 * Alle oordelen zijn regels op basis van cijfers; geen advies.
 */

export interface Fundamentals {
	symbol: string;
	name: string;
	type: 'equity' | 'etf' | 'other';
	currency: string;
	price: number | null;
	sector: string | null;
	industry: string | null;
	summary: string | null;
	website: string | null;
	employees: number | null;
	country?: string | null;
	analyst: {
		count: number | null;
		strongBuy: number;
		buy: number;
		hold: number;
		sell: number;
		strongSell: number;
		mean: number | null;
		key: string | null;
		targetMean: number | null;
		targetHigh: number | null;
		targetLow: number | null;
	} | null;
	valuation: {
		trailingPE: number | null;
		forwardPE: number | null;
		peg: number | null;
		priceToSales?: number | null;
		marketCap: number | null;
		beta: number | null;
		dividendYield: number | null;
		trailingEps: number | null;
		forwardEps: number | null;
	};
	margins: { gross: number | null; operating: number | null; net: number | null; roe: number | null };
	balance?: { cash: number | null; debt: number | null; debtToEquity: number | null; freeCashflow: number | null };
	growth: { revenueYoY: number | null; earningsYoY: number | null; analyst5y: number | null; nextYearEps?: number | null; revenue5y?: number | null; eps5y?: number | null };
	history: {
		years: string[];
		revenue: (number | null)[];
		eps: (number | null)[];
		netIncome: (number | null)[];
		operatingIncome: (number | null)[];
		grossProfit: (number | null)[];
		rd: (number | null)[];
		shares: (number | null)[];
		fcf?: (number | null)[];
	};
	source: string;
	partial?: string | null;
	fetchedAt: number;
}

const cache = new Map<string, Fundamentals>();

export async function fetchFundamentals(symbol: string): Promise<Fundamentals | { error: string }> {
	const hit = cache.get(symbol);
	if (hit && Date.now() - hit.fetchedAt < 3600_000) return hit;
	const p = await provider();
	try {
		let f: Fundamentals;
		if (p === 'api') {
			const r = await fetch(`${base}/api/analysis?symbol=${encodeURIComponent(symbol)}`);
			const j = await r.json();
			if (!r.ok || j.error) return { error: j.error ?? 'Geen data' };
			f = j;
		} else if (p === 'finnhub') {
			f = await fromFinnhub(symbol);
		} else return { error: 'Geen databron. Host op Vercel of vul een Finnhub-sleutel in.' };
		cache.set(symbol, f);
		return f;
	} catch (e) {
		return { error: (e as Error).message || 'Ophalen mislukt' };
	}
}

async function fromFinnhub(symbol: string): Promise<Fundamentals> {
	const key = get(settings).finnhubKey;
	const fh = async (path: string) => {
		const r = await fetch(`https://finnhub.io/api/v1${path}&token=${encodeURIComponent(key)}`);
		if (!r.ok) throw new Error(`Finnhub ${r.status}`);
		return r.json();
	};
	const [profile, recs, metric] = await Promise.all([
		fh(`/stock/profile2?symbol=${encodeURIComponent(symbol)}`).catch(() => ({})),
		fh(`/stock/recommendation?symbol=${encodeURIComponent(symbol)}`).catch(() => []),
		fh(`/stock/metric?symbol=${encodeURIComponent(symbol)}&metric=all`).catch(() => ({}))
	]);
	const m = metric?.metric ?? {};
	const pc = (v: unknown) => (typeof v === 'number' ? v / 100 : null);
	const n = (v: unknown) => (typeof v === 'number' ? v : null);
	const epsSeries: { period: string; v: number }[] = metric?.series?.annual?.eps ?? [];
	const sorted = [...epsSeries].sort((a, b) => a.period.localeCompare(b.period)).slice(-6);
	const rec = Array.isArray(recs) ? recs[0] : null;
	if (!profile?.name && !rec && !Object.keys(m).length) throw new Error('Niet beschikbaar in gratis Finnhub (vaak alleen VS-aandelen)');
	return {
		symbol,
		name: profile?.name ?? symbol,
		type: 'equity',
		currency: profile?.currency ?? 'USD',
		price: null,
		sector: null,
		industry: profile?.finnhubIndustry ?? null,
		summary: null,
		website: profile?.weburl ?? null,
		employees: null,
		country: profile?.country ?? null,
		analyst: rec
			? { count: rec.strongBuy + rec.buy + rec.hold + rec.sell + rec.strongSell, strongBuy: rec.strongBuy, buy: rec.buy, hold: rec.hold, sell: rec.sell, strongSell: rec.strongSell, mean: null, key: null, targetMean: null, targetHigh: null, targetLow: null }
			: null,
		valuation: {
			trailingPE: n(m.peTTM) ?? n(m.peExclExtraTTM),
			forwardPE: n(m.forwardPE),
			peg: null,
			marketCap: profile?.marketCapitalization ? profile.marketCapitalization * 1e6 : null,
			beta: n(m.beta),
			dividendYield: pc(m.currentDividendYieldTTM),
			trailingEps: n(m.epsTTM) ?? n(m.epsExclExtraItemsTTM),
			forwardEps: null
		},
		margins: { gross: pc(m.grossMarginTTM), operating: pc(m.operatingMarginTTM), net: pc(m.netProfitMarginTTM), roe: pc(m.roeTTM) },
		growth: { revenueYoY: pc(m.revenueGrowthTTMYoy), earningsYoY: pc(m.epsGrowthTTMYoy), analyst5y: null, revenue5y: pc(m.revenueGrowth5Y), eps5y: pc(m.epsGrowth5Y) },
		history: {
			years: sorted.map((x) => x.period.slice(0, 4)),
			revenue: sorted.map(() => null),
			eps: sorted.map((x) => x.v),
			netIncome: [],
			operatingIncome: [],
			grossProfit: [],
			rd: [],
			shares: []
		},
		source: 'Finnhub',
		fetchedAt: Date.now()
	};
}

// ───────────────────────────────────── berekeningen

/** Laatste en eerste geldige waarde in een reeks, met het aantal jaren ertussen. */
function span(xs: (number | null)[]) {
	const idx = xs.map((v, i) => (v != null && isFinite(v) ? i : -1)).filter((i) => i >= 0);
	if (idx.length < 2) return null;
	const a = idx[0];
	const b = idx[idx.length - 1];
	return { first: xs[a]!, last: xs[b]!, years: b - a, values: idx.map((i) => xs[i]!) };
}

export function cagr(first: number, last: number, years: number): number | null {
	if (years <= 0 || first <= 0 || last <= 0) return null;
	return Math.pow(last / first, 1 / years) - 1;
}

const ratio = (a: (number | null)[], b: (number | null)[]) => a.map((x, i) => (x != null && b[i] ? x / b[i]! : null));

export interface Indicator {
	label: string;
	ok: boolean | null;
	value: string;
	uitleg: string;
}

export interface BusinessModel {
	model: string;
	moat: string;
	sticky: 'hoog' | 'gemiddeld' | 'laag' | 'onbekend';
	ipHeavy: boolean;
}

/** Vertaalt de branche naar een begrijpelijk verdienmodel met typische voordelen. */
export function businessModel(industry: string | null, sector: string | null): BusinessModel {
	const s = `${industry ?? ''} ${sector ?? ''}`.toLowerCase();
	const r = (model: string, moat: string, sticky: BusinessModel['sticky'], ipHeavy = false): BusinessModel => ({ model, moat, sticky, ipHeavy });
	if (/software|application|infrastructure|saas/.test(s)) return r('Software, vaak als abonnement (SaaS) of licentie', 'Overstapkosten en ingebakken in werkprocessen van klanten; data en integraties maken overstappen duur.', 'hoog', true);
	if (/semiconductor equipment/.test(s)) return r('Machines en onderhoud voor chipfabrikanten', 'Technologische voorsprong en patenten; weinig tot geen concurrenten; jarenlange service-contracten.', 'hoog', true);
	if (/semiconductor/.test(s)) return r('Ontwerp en verkoop van chips', 'Intellectueel eigendom, ontwerp-ecosysteem en software rond de chips (bijv. ontwikkelplatformen).', 'gemiddeld', true);
	if (/internet content|interactive media/.test(s)) return r('Advertenties en/of abonnementen op een online platform', 'Netwerkeffect: hoe meer gebruikers, hoe waardevoller voor adverteerders en gebruikers.', 'hoog');
	if (/internet retail|specialty retail|e-commerce/.test(s)) return r('Online verkoop en marktplaats, vaak met logistiek en abonnement', 'Schaalvoordeel in logistiek, marktplaats-netwerkeffect, loyaliteitsprogramma\'s.', 'gemiddeld');
	if (/consumer electronics|computer hardware/.test(s)) return r('Hardware plus software-ecosysteem en diensten', 'Merk en ecosysteem: apparaten, apps en diensten werken samen, waardoor klanten blijven.', 'hoog', true);
	if (/biotech|drug|pharma/.test(s)) return r('Ontwikkeling en verkoop van medicijnen', 'Patenten op medicijnen geven jarenlang exclusiviteit; let op patentkliffen als die aflopen.', 'gemiddeld', true);
	if (/medical|health care equipment|diagnostics/.test(s)) return r('Medische apparatuur en verbruiksartikelen', 'Regulering (certificering), patenten en training van artsen op het eigen systeem.', 'hoog', true);
	if (/credit services|payment|financial data|capital markets/.test(s)) return r('Transactie- of datadiensten voor financiële markten', 'Netwerkeffect en schaal: iedereen gebruikt hetzelfde netwerk of dezelfde data.', 'hoog');
	if (/bank/.test(s)) return r('Rentemarge op leningen en spaargeld, plus provisies', 'Schaal, vertrouwen en regelgeving maken toetreden moeilijk; weinig onderscheidend.', 'gemiddeld');
	if (/insurance/.test(s)) return r('Premies innen en beleggen (float)', 'Schaal en data over risico\'s; klanten blijven vaak jaren.', 'gemiddeld');
	if (/auto/.test(s)) return r('Productie en verkoop van voertuigen, steeds vaker met software', 'Merk en productieschaal; kapitaalintensief en concurrerend.', 'laag');
	if (/beverage|household|personal products|packaged foods|tobacco|confection/.test(s)) return r('Merkproducten in de supermarkt', 'Sterke merken en distributie; prijsmacht bij trouwe klanten.', 'hoog');
	if (/utilit/.test(s)) return r('Levering van energie of water, vaak gereguleerd', 'Gereguleerd (deel)monopolie; stabiel maar weinig groei.', 'hoog');
	if (/oil|gas|energy|mining|steel|chemical/.test(s)) return r('Grondstoffen winnen of verwerken', 'Afhankelijk van grondstofprijzen; voordeel zit in lage kosten per eenheid.', 'laag');
	if (/telecom/.test(s)) return r('Abonnementen op mobiel en internet', 'Infrastructuur en licenties; klanten stappen niet snel over.', 'gemiddeld');
	if (/restaurant|leisure|travel|lodging|airline/.test(s)) return r('Consumentendiensten (horeca, reizen)', 'Merk en locaties; gevoelig voor de economie.', 'laag');
	if (/aerospace|defense/.test(s)) return r('Vliegtuigen, defensie en onderhoudscontracten', 'Langlopende overheidscontracten, certificering en patenten.', 'hoog', true);
	return r(industry ?? 'Onbekend', 'Geen standaardprofiel voor deze branche; lees de bedrijfsomschrijving.', 'onbekend');
}

export interface TenX {
	neededCagr5: number;
	neededCagr10: number;
	growth: number;
	growthSource: string;
	exitPE: number;
	baseEps: number | null;
	method: 'eps' | 'omzet';
	multiple5: number | null;
	multiple10: number | null;
	yearsTo10x: number | null;
	impliedMarketCap: number | null;
	verdict: string;
	tone: 'pos' | 'warn' | 'neg';
	notes: string[];
}

export interface AnalysisResult {
	revenue: { cagr: number | null; doublingYears: number | null; yearsUp: number; years: number; verdict: string; tone: 'pos' | 'warn' | 'neg' };
	eps: { cagr: number | null; rising: boolean | null; yearsUp: number; years: number; latest: number | null; reasons: string[] };
	analyst: { buyPct: number; holdPct: number; sellPct: number; total: number; upside: number | null; label: string } | null;
	indicators: Indicator[];
	moatScore: number;
	model: BusinessModel;
	tenX: TenX;
}

const pctStr = (v: number | null, d = 0) => (v == null ? '—' : `${(v * 100).toFixed(d).replace('.', ',')}%`);

export function defaultAssumptions(f: Fundamentals) {
	const rev = span(f.history.revenue);
	const eps = span(f.history.eps);
	const revC = rev ? cagr(rev.first, rev.last, rev.years) : f.growth.revenue5y ?? null;
	const epsC = eps ? cagr(eps.first, eps.last, eps.years) : f.growth.eps5y ?? null;
	let growth: number;
	let growthSource: string;
	if (f.growth.analyst5y != null) {
		growth = f.growth.analyst5y;
		growthSource = 'verwachting analisten (EPS-groei per jaar, komende 5 jaar)';
	} else if (epsC != null && revC != null) {
		growth = (epsC + revC) / 2;
		growthSource = 'gemiddelde van historische omzet- en EPS-groei';
	} else if (revC != null) {
		growth = revC;
		growthSource = 'historische omzetgroei';
	} else if (epsC != null) {
		growth = epsC;
		growthSource = 'historische EPS-groei';
	} else {
		growth = 0.08;
		growthSource = 'standaardaanname (geen historie beschikbaar)';
	}
	growth = Math.max(-0.2, Math.min(0.6, growth));
	const pe = f.valuation.forwardPE ?? f.valuation.trailingPE;
	const exitPE = Math.round(pe && pe > 0 ? Math.min(pe, 30) : 20);
	return { growth, growthSource, exitPE };
}

export function analyze(f: Fundamentals, opts?: { growth?: number; exitPE?: number }): AnalysisResult {
	const H = f.history;
	// ── omzet
	const rev = span(H.revenue);
	const revC = rev ? cagr(rev.first, rev.last, rev.years) : f.growth.revenue5y ?? null;
	const revUp = rev ? rev.values.slice(1).filter((v, i) => v > rev.values[i]).length : 0;
	const doubling = revC && revC > 0 ? Math.log(2) / Math.log(1 + revC) : null;
	let revVerdict = 'Onvoldoende omzethistorie';
	let revTone: 'pos' | 'warn' | 'neg' = 'warn';
	if (revC != null) {
		if (doubling != null && doubling <= 1) [revVerdict, revTone] = ['Ja: de omzet verdubbelt ongeveer elk jaar', 'pos'];
		else if (doubling != null && doubling <= 2) [revVerdict, revTone] = [`Ja: de omzet verdubbelt ongeveer elke ${doubling.toFixed(1).replace('.', ',')} jaar`, 'pos'];
		else if (doubling != null && doubling <= 5) [revVerdict, revTone] = [`Nee: verdubbeling duurt ± ${doubling.toFixed(1).replace('.', ',')} jaar (sterke, maar geen explosieve groei)`, 'warn'];
		else if (doubling != null) [revVerdict, revTone] = [`Nee: in dit tempo duurt verdubbelen ± ${Math.round(doubling)} jaar`, 'neg'];
		else [revVerdict, revTone] = ['Nee: de omzet krimpt', 'neg'];
	}

	// ── EPS
	const eps = span(H.eps);
	const epsC = eps ? cagr(eps.first, eps.last, eps.years) : f.growth.eps5y ?? null;
	const epsUp = eps ? eps.values.slice(1).filter((v, i) => v > eps.values[i]).length : 0;
	const lastTwo = eps ? eps.values.slice(-2) : [];
	const rising = eps ? (eps.last > eps.first && (lastTwo.length < 2 || lastTwo[1] >= lastTwo[0])) : epsC != null ? epsC > 0 : null;
	const reasons: string[] = [];
	const opM = ratio(H.operatingIncome, H.revenue);
	const opS = span(opM);
	const sh = span(H.shares);
	const rdS = span(ratio(H.rd, H.revenue));
	const niS = span(H.netIncome);
	const oiS = span(H.operatingIncome);
	if (rising === false || (epsC != null && epsC < 0.03)) {
		if (rev && rev.last < rev.first) reasons.push(`De omzet is gedaald (${pctStr(revC, 1)} per jaar): minder verkoop betekent minder winst.`);
		if (opS && opS.last < opS.first - 0.03) reasons.push(`De operationele marge zakte van ${pctStr(opS.first)} naar ${pctStr(opS.last)}: kosten stegen harder dan de omzet.`);
		if (sh && sh.last > sh.first * 1.05) reasons.push(`Het aantal aandelen steeg met ${pctStr(sh.last / sh.first - 1)} (verwatering door uitgifte of aandelenopties), dus de winst wordt over meer aandelen verdeeld.`);
		if (rdS && rdS.last > rdS.first + 0.03) reasons.push(`Het bedrijf investeert meer in R&D (${pctStr(rdS.first)} → ${pctStr(rdS.last)} van de omzet). Dat drukt de winst nu, maar kan toekomstige groei opleveren.`);
		if (niS && oiS && niS.last < niS.first && oiS.last > oiS.first) reasons.push('De operationele winst steeg wél: de daling komt door rente, belasting of eenmalige posten.');
		if (eps && eps.last <= 0) reasons.push('Het bedrijf maakt (nog) verlies per aandeel.');
		if (!reasons.length) reasons.push('Uit de beschikbare jaarcijfers is geen duidelijke oorzaak af te leiden; lees het jaarverslag (sectie "Management Discussion").');
	} else if (rising) {
		if (sh && sh.last < sh.first * 0.97) reasons.push(`Het aantal aandelen daalde ${pctStr(1 - sh.last / sh.first)} door inkoop van eigen aandelen; dat stuwt de EPS extra.`);
		if (opS && opS.last > opS.first + 0.03) reasons.push(`De marges verbeterden (${pctStr(opS.first)} → ${pctStr(opS.last)} operationeel): schaalvoordeel of prijsmacht.`);
		if (epsC != null && revC != null && epsC > revC + 0.03) reasons.push('De winst per aandeel groeit sneller dan de omzet: een teken van operationele hefboom.');
	}

	// ── analisten
	let analyst: AnalysisResult['analyst'] = null;
	if (f.analyst) {
		const a = f.analyst;
		const total = a.strongBuy + a.buy + a.hold + a.sell + a.strongSell;
		if (total > 0) {
			const buyPct = (a.strongBuy + a.buy) / total;
			const sellPct = (a.sell + a.strongSell) / total;
			const upside = a.targetMean && f.price ? a.targetMean / f.price - 1 : null;
			const label = buyPct >= 0.7 ? 'Sterk kopen' : buyPct >= 0.5 ? 'Kopen' : sellPct >= 0.3 ? 'Verkopen' : 'Houden';
			analyst = { buyPct, holdPct: a.hold / total, sellPct, total, upside, label };
		}
	}

	// ── moat-indicatoren
	const model = businessModel(f.industry, f.sector);
	const rdLast = rdS?.last ?? null;
	const indicators: Indicator[] = [
		{ label: 'Prijsmacht', ok: f.margins.gross == null ? null : f.margins.gross >= 0.5, value: `brutomarge ${pctStr(f.margins.gross)}`, uitleg: 'Een brutomarge boven 50% betekent dat klanten veel meer betalen dan het product kost om te maken.' },
		{ label: 'Winstgevendheid', ok: f.margins.operating == null ? null : f.margins.operating >= 0.2, value: `operationele marge ${pctStr(f.margins.operating)}`, uitleg: 'Boven 20% houdt het bedrijf ruim geld over na alle kosten.' },
		{ label: 'Rendement op eigen vermogen', ok: f.margins.roe == null ? null : f.margins.roe >= 0.15, value: `ROE ${pctStr(f.margins.roe)}`, uitleg: 'Boven 15% wijst op een bedrijf dat kapitaal efficiënt inzet: vaak een teken van een duurzaam voordeel.' },
		{ label: 'Innovatie / patenten', ok: rdLast == null ? null : rdLast >= 0.08, value: rdLast == null ? (model.ipHeavy ? 'IP-zware branche' : 'R&D onbekend') : `R&D ${pctStr(rdLast)} van omzet`, uitleg: 'Veel R&D in een IP-zware branche duidt op patenten en technologische voorsprong. Controleer het aantal patenten via Google Patents.' },
		{ label: 'Consistente groei', ok: rev ? revUp >= Math.max(1, rev.values.length - 2) : null, value: rev ? `${revUp} van ${rev.values.length - 1} jaar omzetgroei` : '—', uitleg: 'Elk jaar meer omzet wijst op een product waar klanten bij blijven (sticky).' },
		{ label: 'Plakkerig product', ok: model.sticky === 'hoog' ? true : model.sticky === 'laag' ? false : null, value: `typisch: ${model.sticky}`, uitleg: 'Gebaseerd op het verdienmodel van de branche: hoe moeilijk is overstappen naar een concurrent?' }
	];
	const known = indicators.filter((i) => i.ok != null);
	const moatScore = known.length ? Math.round((known.filter((i) => i.ok).length / known.length) * 100) : 0;

	// ── 10x
	const def = defaultAssumptions(f);
	const growth = opts?.growth ?? def.growth;
	const exitPE = opts?.exitPE ?? def.exitPE;
	const price = f.price;
	const baseEps = f.valuation.forwardEps ?? f.valuation.trailingEps ?? eps?.last ?? null;
	const neededCagr5 = Math.pow(10, 1 / 5) - 1;
	const neededCagr10 = Math.pow(10, 1 / 10) - 1;
	const notes: string[] = [];
	let method: TenX['method'] = 'eps';
	let multiple = (n: number): number | null => null;
	if (price && baseEps && baseEps > 0) {
		multiple = (n) => (baseEps * Math.pow(1 + growth, n) * exitPE) / price;
		notes.push(`Koers over n jaar = EPS ${baseEps.toFixed(2)} × (1 + ${pctStr(growth, 1)})ⁿ × K/W ${exitPE}.`);
	} else if (price) {
		method = 'omzet';
		multiple = (n) => Math.pow(1 + growth, n);
		notes.push('Geen positieve winst: we rekenen met omzetgroei bij een gelijkblijvende koers/omzet-verhouding.');
	}
	const m5 = multiple(5);
	const m10 = multiple(10);
	let yearsTo10x: number | null = null;
	if (m5 != null && growth > 0) {
		const m0 = multiple(0)!;
		yearsTo10x = m0 >= 10 ? 0 : Math.log(10 / m0) / Math.log(1 + growth);
	}
	const cap = f.valuation.marketCap;
	const impliedMarketCap = cap ? cap * 10 : null;
	if (impliedMarketCap && impliedMarketCap > 5e12) notes.push(`10x betekent een beurswaarde van ± ${(impliedMarketCap / 1e12).toFixed(0)} biljoen: groter dan welk bedrijf ooit. Hoe groter het bedrijf, hoe moeilijker 10x wordt.`);
	else if (impliedMarketCap && impliedMarketCap > 1e12) notes.push(`10x betekent een beurswaarde van ± ${(impliedMarketCap / 1e12).toFixed(1).replace('.', ',')} biljoen: het zou een van de grootste bedrijven ter wereld worden.`);
	else if (impliedMarketCap && impliedMarketCap < 1e11) notes.push('Kleinere bedrijven hebben meer ruimte om 10x te groeien, maar vallen ook vaker om.');
	if (f.valuation.trailingPE && f.valuation.trailingPE > 50) notes.push(`De huidige K/W van ${f.valuation.trailingPE.toFixed(0)} is hoog: er zit al veel groei in de koers.`);
	if (exitPE < (f.valuation.trailingPE ?? 0)) notes.push(`We gaan uit van een lagere K/W in de toekomst (${exitPE}), omdat snelle groei meestal afvlakt.`);

	let verdict: string;
	let tone: TenX['tone'];
	if (yearsTo10x == null) [verdict, tone] = ['10x is met de huidige groei niet te onderbouwen', 'neg'];
	else if (yearsTo10x <= 5) [verdict, tone] = [`Mogelijk binnen ± ${Math.max(1, Math.round(yearsTo10x))} jaar, maar dat vraagt uitzonderlijke groei die je zelden lang ziet`, 'pos'];
	else if (yearsTo10x <= 10) [verdict, tone] = [`Haalbaar op ± ${Math.round(yearsTo10x)} jaar als de groei aanhoudt`, 'pos'];
	else if (yearsTo10x <= 20) [verdict, tone] = [`Pas op lange termijn: ± ${Math.round(yearsTo10x)} jaar`, 'warn'];
	else [verdict, tone] = [`Onwaarschijnlijk: in dit tempo duurt 10x ± ${Math.round(yearsTo10x)} jaar`, 'neg'];
	// realiteitscheck op omvang: 10x van een reus is iets anders dan 10x van een klein bedrijf
	if (impliedMarketCap && impliedMarketCap > 5e12 && tone === 'pos') {
		verdict = `Rekenkundig ± ${Math.round(yearsTo10x!)} jaar, maar dan wordt het veruit het grootste bedrijf ooit: in de praktijk zeer onwaarschijnlijk`;
		tone = 'warn';
	} else if (impliedMarketCap && impliedMarketCap > 1.5e12 && tone === 'pos') {
		verdict += ', al moet het dan uitgroeien tot een van de grootste bedrijven ter wereld';
	}

	return {
		revenue: { cagr: revC, doublingYears: doubling, yearsUp: revUp, years: rev ? rev.values.length - 1 : 0, verdict: revVerdict, tone: revTone },
		eps: { cagr: epsC, rising, yearsUp: epsUp, years: eps ? eps.values.length - 1 : 0, latest: eps?.last ?? f.valuation.trailingEps, reasons },
		analyst,
		indicators,
		moatScore,
		model,
		tenX: { neededCagr5, neededCagr10, growth, growthSource: opts?.growth != null ? 'jouw aanname' : def.growthSource, exitPE, baseEps, method, multiple5: m5, multiple10: m10, yearsTo10x, impliedMarketCap, verdict, tone, notes }
	};
}
