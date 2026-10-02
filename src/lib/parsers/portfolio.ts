import { readCsv, findCol, parseNumber, parseDate, detectDecimal, norm, type CsvTable } from './csv';

/**
 * Portfolio-import voor brokerexports.
 *
 * Ondersteund (automatisch herkend):
 *  - Trading 212: "History" export (transacties)
 *  - DEGIRO: Portfolio.csv (posities) en Transactions.csv (transacties)
 *  - Trade Republic: transactie-export (o.a. via pytr / Portfolio Performance-formaat) en generieke TR-CSV
 *  - ING Zelf Beleggen / overige: herkenning op kolomnamen (posities óf transacties)
 * Lukt herkennen niet, dan kan de gebruiker de kolommen zelf koppelen.
 */

export type PfField =
	| 'date'
	| 'type'
	| 'isin'
	| 'ticker'
	| 'name'
	| 'quantity'
	| 'price'
	| 'priceCurrency'
	| 'fx'
	| 'total'
	| 'totalCurrency'
	| 'value'
	| 'cost'
	| 'avgPrice'
	| 'fees';

export type PfMode = 'transactions' | 'snapshot';

export interface PfMapping {
	mode: PfMode;
	preset: string;
	cols: Partial<Record<PfField, number>>;
}

export const PF_FIELD_LABELS: Record<PfField, string> = {
	date: 'Datum',
	type: 'Soort transactie',
	isin: 'ISIN',
	ticker: 'Ticker / symbool',
	name: 'Naam product',
	quantity: 'Aantal',
	price: 'Koers per stuk',
	priceCurrency: 'Valuta koers',
	fx: 'Wisselkoers',
	total: 'Totaalbedrag (EUR)',
	totalCurrency: 'Valuta totaal',
	value: 'Huidige waarde (EUR)',
	cost: 'Aankoopwaarde totaal (EUR)',
	avgPrice: 'Gem. aankoopkoers',
	fees: 'Kosten'
};

export const PF_FIELDS_BY_MODE: Record<PfMode, PfField[]> = {
	transactions: ['date', 'type', 'isin', 'ticker', 'name', 'quantity', 'price', 'priceCurrency', 'fx', 'total', 'totalCurrency', 'fees'],
	snapshot: ['isin', 'ticker', 'name', 'quantity', 'price', 'priceCurrency', 'value', 'cost', 'avgPrice']
};

const SYN: Record<PfField, string[]> = {
	date: ['datum', 'date', 'time', 'transactiedatum', 'boekdatum', 'uitvoeringsdatum', 'trade date', 'datetime', 'zeit'],
	type: ['action', 'type', 'typ', 'transactietype', 'soort transactie', 'soort', 'transaction type', 'order type', 'kind'],
	isin: ['isin', 'symbool/isin', 'symbol/isin', 'isin code', 'isin-code'],
	ticker: ['ticker', 'symbol', 'symbool', 'tickersymbool'],
	name: ['name', 'naam', 'product', 'fondsnaam', 'fonds', 'instrument', 'security', 'effect', 'titel', 'omschrijving', 'description', 'wertpapier', 'note', 'notiz'],
	quantity: ['no. of shares', 'aantal', 'shares', 'quantity', 'stuks', 'stuk', 'stuck', 'units', 'aantal stuks', 'number of shares', 'qty'],
	price: ['price / share', 'koers', 'slotkoers', 'price', 'prijs', 'koers per stuk', 'kurs', 'share price', 'last price', 'laatste koers'],
	priceCurrency: ['currency (price / share)', 'valuta', 'currency', 'munt', 'wahrung'],
	fx: ['exchange rate', 'wisselkoers', 'fx rate', 'wechselkurs'],
	total: ['total', 'totaal', 'wert', 'value', 'amount', 'bedrag', 'netto bedrag', 'betrag', 'totaal eur', 'total eur'],
	totalCurrency: ['currency (total)'],
	value: ['waarde in eur', 'value in eur', 'marktwaarde', 'market value', 'huidige waarde', 'waarde', 'value', 'current value', 'positiewaarde'],
	cost: ['aankoopwaarde', 'kostprijs', 'cost basis', 'invested', 'inleg', 'aanschafwaarde', 'purchase value', 'totale kosten', 'kostenbasis', 'einstandswert'],
	avgPrice: ['gem. aankoopkoers', 'gemiddelde aankoopkoers', 'gak', 'average price', 'avg price', 'average cost', 'aankoopkoers', 'gem aankoopprijs', 'einstandskurs'],
	fees: ['fees', 'transactiekosten en/of', 'transactiekosten', 'kosten', 'gebuhren', 'fee', 'commission']
};

export interface DetectResult {
	mapping: PfMapping;
	confident: boolean;
}

export function detectPortfolio(t: CsvTable): DetectResult {
	const H = t.headers.map(norm);
	const has = (s: string) => H.includes(norm(s));
	const col = (f: PfField, syn = SYN[f], ex: number[] = []) => findCol(t.headers, syn, ex);

	// Trading 212
	if (has('action') && (has('no. of shares') || H.some((h) => h.startsWith('no of shares')))) {
		return {
			confident: true,
			mapping: {
				mode: 'transactions',
				preset: 'Trading 212',
				cols: {
					date: col('date', ['time']),
					type: col('type', ['action']),
					isin: col('isin'),
					ticker: col('ticker', ['ticker']),
					name: col('name', ['name']),
					quantity: col('quantity', ['no. of shares']),
					price: col('price', ['price / share']),
					priceCurrency: col('priceCurrency', ['currency (price / share)']),
					fx: col('fx', ['exchange rate']),
					total: col('total', ['total']),
					totalCurrency: col('totalCurrency', ['currency (total)'])
				}
			}
		};
	}

	// DEGIRO Portfolio.csv
	if (has('product') && (has('symbool/isin') || has('symbol/isin'))) {
		const val = col('value', ['waarde in eur', 'value in eur', 'waarde', 'value']);
		return {
			confident: true,
			mapping: {
				mode: 'snapshot',
				preset: 'DEGIRO (portefeuille)',
				cols: {
					name: col('name', ['product']),
					isin: col('isin', ['symbool/isin', 'symbol/isin']),
					quantity: col('quantity', ['aantal', 'quantity', 'amount']),
					price: col('price', ['slotkoers', 'closing', 'koers']),
					priceCurrency: col('priceCurrency', ['lokale waarde', 'local value']),
					value: val
				}
			}
		};
	}

	// DEGIRO Transactions.csv
	if (has('product') && has('isin') && (has('order id') || has('wisselkoers') || has('exchange rate')) && (has('aantal') || has('quantity'))) {
		return {
			confident: true,
			mapping: {
				mode: 'transactions',
				preset: 'DEGIRO (transacties)',
				cols: {
					date: col('date', ['datum', 'date']),
					name: col('name', ['product']),
					isin: col('isin', ['isin']),
					quantity: col('quantity', ['aantal', 'quantity']),
					price: col('price', ['koers', 'price']),
					fx: col('fx', ['wisselkoers', 'exchange rate']),
					total: col('total', ['totaal eur', 'total eur', 'totaal', 'total']),
					fees: col('fees', ['transactiekosten en/of', 'transactiekosten', 'transaction and/or third', 'transaction costs'])
				}
			}
		};
	}

	// Portfolio Performance / pytr (Trade Republic) — Duits of Engels
	if ((has('typ') || has('type')) && (has('wert') || has('value')) && (has('stuck') || has('shares')) && has('isin')) {
		return {
			confident: true,
			mapping: {
				mode: 'transactions',
				preset: 'Trade Republic (pytr / Portfolio Performance)',
				cols: {
					date: col('date', ['datum', 'date']),
					type: col('type', ['typ', 'type']),
					total: col('total', ['wert', 'value']),
					name: col('name', ['notiz', 'note', 'name']),
					isin: col('isin'),
					quantity: col('quantity', ['stuck', 'shares']),
					fees: col('fees', ['gebuhren', 'fees'])
				}
			}
		};
	}

	// Generiek: transacties als er datum + (type of signed aantal) + aantal is, anders posities
	const date = col('date');
	const type = col('type');
	const quantity = col('quantity');
	const isTx = date >= 0 && quantity >= 0 && (type >= 0 || col('total') >= 0) && col('value', ['waarde in eur', 'marktwaarde', 'market value', 'huidige waarde']) < 0;
	const isTR = H.some((h) => h.includes('trade republic')) ;
	if (isTx) {
		const used: number[] = [];
		const c = (f: PfField) => {
			const i = col(f, SYN[f], used);
			if (i >= 0) used.push(i);
			return i;
		};
		const cols: PfMapping['cols'] = {};
		for (const f of ['date', 'type', 'isin', 'ticker', 'quantity', 'price', 'fx', 'fees', 'total', 'name', 'priceCurrency'] as PfField[]) cols[f] = c(f);
		return { confident: false, mapping: { mode: 'transactions', preset: isTR ? 'Trade Republic' : 'Generiek (transacties)', cols } };
	}
	const used: number[] = [];
	const c = (f: PfField) => {
		const i = col(f, SYN[f], used);
		if (i >= 0) used.push(i);
		return i;
	};
	const cols: PfMapping['cols'] = {};
	for (const f of ['isin', 'ticker', 'quantity', 'avgPrice', 'cost', 'value', 'price', 'priceCurrency', 'name'] as PfField[]) cols[f] = c(f);
	const confident = (cols.quantity ?? -1) >= 0 && ((cols.isin ?? -1) >= 0 || (cols.name ?? -1) >= 0) && ((cols.value ?? -1) >= 0 || (cols.price ?? -1) >= 0);
	return { confident, mapping: { mode: 'snapshot', preset: 'Generiek (posities, bijv. ING)', cols } };
}

// ───────────────────────────────── opbouw van posities

export type TxKind = 'buy' | 'sell' | 'dividend' | 'deposit' | 'withdrawal' | 'fee' | 'interest' | 'tax' | 'other';

export function classify(type: string, quantity: number | null): TxKind {
	const t = norm(type);
	if (t) {
		if (/(^| )(buy|kauf|koop|aankoop|purchase|sparplan|savings plan|bought|inleg fonds)/.test(t)) return 'buy';
		if (/(^| )(sell|verkauf|verkoop|sold)/.test(t)) return 'sell';
		if (/dividend|dividende|uitkering|distribution|ausschuttung/.test(t)) return 'dividend';
		if (/deposit|storting|einlage|top ?up|overboeking naar/.test(t)) return 'deposit';
		if (/withdraw|opname|entnahme|uitbetaling/.test(t)) return 'withdrawal';
		if (/interest|rente|zinsen/.test(t)) return 'interest';
		if (/tax|steuer|belasting|bronbelasting/.test(t)) return 'tax';
		if (/fee|kosten|gebuhr|commission/.test(t)) return 'fee';
		if (/split|conversion|conversie|currency/.test(t)) return 'other';
	}
	if (quantity != null && quantity !== 0) return quantity > 0 ? 'buy' : 'sell';
	return 'other';
}

export interface Holding {
	key: string;
	name: string;
	isin?: string;
	ticker?: string;
	quantity: number;
	/** Resterende aankoopwaarde in EUR (gemiddelde-kostprijsmethode); null als onbekend */
	costEur: number | null;
	/** Laatst bekende koers uit het bestand */
	lastPrice: number | null;
	priceCurrency: string;
	/** Waarde volgens het bestand (EUR), alleen bij positie-exports */
	fileValueEur: number | null;
	realizedEur: number;
	dividendsEur: number;
}

export interface PortfolioImport {
	id: string;
	broker: string;
	fileName: string;
	importedAt: string;
	mode: PfMode;
	holdings: Holding[];
	txCount: number;
	firstDate: string | null;
	lastDate: string | null;
	deposits: number;
	withdrawals: number;
	dividends: number;
	fees: number;
	interest: number;
	taxes: number;
	/** Contant saldo bij de broker (alleen bekend bij positie-exports) */
	cashEur: number;
	warnings: string[];
}

const ISIN_RE = /\b([A-Z]{2}[A-Z0-9]{9}\d)\b/;

function keyFor(isin?: string, ticker?: string, name?: string) {
	return (isin || ticker || name || '?').toUpperCase();
}

export function buildPortfolio(t: CsvTable, mapping: PfMapping, meta: { id: string; fileName: string }): PortfolioImport {
	const { cols } = mapping;
	const get = (r: string[], f: PfField) => (cols[f] != null && cols[f]! >= 0 ? r[cols[f]!] ?? '' : '');
	const decimals: Partial<Record<PfField, ',' | '.' | undefined>> = {};
	for (const f of ['quantity', 'price', 'fx', 'total', 'value', 'cost', 'avgPrice', 'fees'] as PfField[]) {
		if (cols[f] != null && cols[f]! >= 0) decimals[f] = detectDecimal(t.rows.map((r) => r[cols[f]!]));
	}
	const n = (r: string[], f: PfField) => parseNumber(get(r, f), decimals[f]);

	const warnings: string[] = [];
	const map = new Map<string, Holding>();
	const out: PortfolioImport = {
		id: meta.id,
		broker: mapping.preset,
		fileName: meta.fileName,
		importedAt: new Date().toISOString(),
		mode: mapping.mode,
		holdings: [],
		txCount: 0,
		firstDate: null,
		lastDate: null,
		deposits: 0,
		withdrawals: 0,
		dividends: 0,
		fees: 0,
		interest: 0,
		taxes: 0,
		cashEur: 0,
		warnings
	};

	const holdingFor = (r: string[]): Holding | null => {
		let isin = get(r, 'isin').toUpperCase();
		const m = isin.match(ISIN_RE) ?? get(r, 'name').toUpperCase().match(ISIN_RE);
		isin = m ? m[1] : '';
		const ticker = get(r, 'ticker').toUpperCase() || undefined;
		const name = get(r, 'name') || ticker || isin;
		if (!isin && !ticker && !name) return null;
		const key = keyFor(isin, ticker, name);
		let h = map.get(key);
		if (!h) {
			h = {
				key,
				name: name || key,
				isin: isin || undefined,
				ticker,
				quantity: 0,
				costEur: 0,
				lastPrice: null,
				priceCurrency: /^[A-Za-z]{3}$/.test(get(r, 'priceCurrency')) ? get(r, 'priceCurrency').toUpperCase() : 'EUR',
				fileValueEur: null,
				realizedEur: 0,
				dividendsEur: 0
			};
			map.set(key, h);
		}
		if (name && (h.name === h.key || h.name.length < name.length)) h.name = name;
		return h;
	};

	if (mapping.mode === 'snapshot') {
		for (const r of t.rows) {
			const q = n(r, 'quantity');
			if (q == null || q === 0) {
				// DEGIRO zet contant geld als regel "CASH & CASH FUND" zonder aantal
				if (/cash|geldmarkt|liquid/i.test(get(r, 'name'))) out.cashEur += n(r, 'value') ?? 0;
				continue;
			}
			const h = holdingFor(r);
			if (!h) continue;
			h.quantity += q;
			const price = n(r, 'price');
			if (price != null) h.lastPrice = price;
			const val = n(r, 'value');
			if (val != null) h.fileValueEur = (h.fileValueEur ?? 0) + val;
			const cost = n(r, 'cost');
			const avg = n(r, 'avgPrice');
			if (cost != null) h.costEur = (h.costEur ?? 0) + Math.abs(cost);
			else if (avg != null) h.costEur = (h.costEur ?? 0) + Math.abs(avg * q);
			else h.costEur = null;
			out.txCount++;
		}
	} else {
		// sorteer chronologisch (exports zijn vaak nieuw → oud)
		const rows = t.rows
			.map((r) => ({ r, d: parseDate(get(r, 'date')) }))
			.sort((a, b) => (a.d ?? '').localeCompare(b.d ?? ''));
		for (const { r, d } of rows) {
			const qRaw = n(r, 'quantity');
			const kind = classify(get(r, 'type'), qRaw);
			const q = qRaw == null ? null : Math.abs(qRaw);
			const price = n(r, 'price');
			const totalCur = (get(r, 'totalCurrency') || 'EUR').toUpperCase();
			let total = n(r, 'total');
			if (total != null && totalCur !== 'EUR' && totalCur.length === 3) {
				warnings.push(`Bedrag in ${totalCur} gevonden; omgerekend met wisselkoers uit het bestand waar mogelijk.`);
				const fx = n(r, 'fx');
				total = fx ? total / fx : total;
			}
			const fees = Math.abs(n(r, 'fees') ?? 0);
			if (d) {
				if (!out.firstDate || d < out.firstDate) out.firstDate = d;
				if (!out.lastDate || d > out.lastDate) out.lastDate = d;
			}
			out.txCount++;

			// bedrag in EUR van de transactie
			const eurAmount = (): number | null => {
				if (total != null) return Math.abs(total);
				if (q != null && price != null) {
					const fx = n(r, 'fx');
					return fx && fx !== 1 ? (q * price) / fx : q * price;
				}
				return null;
			};

			switch (kind) {
				case 'buy': {
					const h = holdingFor(r);
					if (!h || q == null) break;
					const amt = eurAmount();
					h.quantity += q;
					if (h.costEur != null && amt != null) h.costEur += amt + (total == null ? fees : 0);
					else h.costEur = null;
					if (price != null) h.lastPrice = price;
					break;
				}
				case 'sell': {
					const h = holdingFor(r);
					if (!h || q == null) break;
					const amt = eurAmount();
					const sellQ = Math.min(q, h.quantity);
					const avgCost = h.quantity > 0 && h.costEur != null ? h.costEur / h.quantity : null;
					if (avgCost != null && h.costEur != null) {
						h.costEur -= avgCost * sellQ;
						if (amt != null) h.realizedEur += amt - avgCost * sellQ;
					}
					if (q > h.quantity + 1e-6) warnings.push(`Verkoop van ${h.name} groter dan bekende positie (mogelijk ontbreekt eerdere historie).`);
					h.quantity -= sellQ;
					if (price != null) h.lastPrice = price;
					break;
				}
				case 'dividend': {
					const amt = eurAmount() ?? 0;
					out.dividends += amt;
					const h = holdingFor(r);
					if (h) h.dividendsEur += amt;
					break;
				}
				case 'deposit':
					out.deposits += Math.abs(total ?? 0);
					break;
				case 'withdrawal':
					out.withdrawals += Math.abs(total ?? 0);
					break;
				case 'interest':
					out.interest += total ?? 0;
					break;
				case 'tax':
					out.taxes += Math.abs(total ?? 0);
					break;
				case 'fee':
					out.fees += Math.abs(total ?? 0);
					break;
			}
			if (kind === 'buy' || kind === 'sell') out.fees += fees;
		}
	}

	out.holdings = [...map.values()]
		.filter((h) => h.quantity > 1e-9)
		.map((h) => ({ ...h, costEur: h.costEur != null ? Math.max(0, h.costEur) : null }));
	if (!out.holdings.length) warnings.push('Geen openstaande posities gevonden. Controleer de kolomkoppeling.');
	out.warnings = [...new Set(warnings)];
	return out;
}

export function parsePortfolioFile(text: string) {
	const table = readCsv(text);
	const det = detectPortfolio(table);
	return { table, ...det };
}
