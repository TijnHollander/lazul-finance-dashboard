import { readCsv, findCol, parseNumber, parseDate, detectDecimal, norm, type CsvTable } from './csv';

/**
 * Bankafschriften (betaalrekening) importeren.
 * Herkend: ING, Rabobank, ABN AMRO (TAB), bunq, Revolut, SNS/ASN/RegioBank (CSV met kop), Knab, Triodos.
 * Anders: kolommen zelf koppelen.
 */

export type BankField = 'date' | 'amount' | 'direction' | 'description' | 'counterparty' | 'counterAccount' | 'account' | 'description2';

export interface BankMapping {
	preset: string;
	cols: Partial<Record<BankField, number>>;
}

export const BANK_FIELD_LABELS: Record<BankField, string> = {
	date: 'Datum',
	amount: 'Bedrag',
	direction: 'Af/Bij (debet/credit)',
	description: 'Omschrijving',
	description2: 'Extra omschrijving',
	counterparty: 'Naam tegenpartij',
	counterAccount: 'Tegenrekening',
	account: 'Eigen rekening'
};

const SYN: Record<BankField, string[]> = {
	date: ['datum', 'date', 'transactiedatum', 'boekdatum', 'completed date', 'started date', 'booking date', 'valutadatum'],
	amount: ['bedrag (eur)', 'bedrag', 'amount', 'transactiebedrag', 'amount (eur)', 'betrag'],
	direction: ['af bij', 'af/bij', 'debet/credit', 'credit/debit', 'debit/credit', 'bij/af'],
	description: ['mededelingen', 'omschrijving-1', 'omschrijving', 'description', 'naam / omschrijving', 'memo', 'verwijzing'],
	description2: ['omschrijving-2', 'betalingskenmerk'],
	counterparty: ['naam tegenpartij', 'naam / omschrijving', 'tegenpartij', 'counterparty', 'name', 'naam', 'naam tegenrekening'],
	counterAccount: ['tegenrekening iban/bban', 'tegenrekening', 'counterparty account', 'iban tegenpartij', 'tegenrekeningnummer'],
	account: ['iban/bban', 'rekening', 'account', 'rekeningnummer', 'eigen rekening', 'iban']
};

export function detectBank(t: CsvTable): { mapping: BankMapping; confident: boolean } {
	const H = t.headers.map(norm);
	const has = (s: string) => H.includes(norm(s));
	const col = (syn: string[], ex: number[] = []) => findCol(t.headers, syn, ex);

	// ABN AMRO .TAB (geen kopregel, 8 kolommen)
	if (!t.hasHeader && t.headers.length >= 8 && /^\d{8}$/.test(t.rows[0]?.[2] ?? '')) {
		return { confident: true, mapping: { preset: 'ABN AMRO (TAB)', cols: { account: 0, date: 2, amount: 6, description: 7 } } };
	}
	// ING
	if (has('naam / omschrijving') && (has('af bij') || has('af/bij'))) {
		return {
			confident: true,
			mapping: {
				preset: 'ING',
				cols: {
					date: col(['datum']),
					counterparty: col(['naam / omschrijving']),
					account: col(['rekening']),
					counterAccount: col(['tegenrekening']),
					direction: col(['af bij', 'af/bij']),
					amount: col(['bedrag (eur)', 'bedrag']),
					description: col(['mededelingen'])
				}
			}
		};
	}
	// Rabobank
	if (has('iban/bban') && has('naam tegenpartij') && has('omschrijving-1')) {
		return {
			confident: true,
			mapping: {
				preset: 'Rabobank',
				cols: {
					account: col(['iban/bban']),
					date: col(['datum']),
					amount: col(['bedrag']),
					counterAccount: col(['tegenrekening iban/bban']),
					counterparty: col(['naam tegenpartij']),
					description: col(['omschrijving-1']),
					description2: col(['omschrijving-2'])
				}
			}
		};
	}
	// Revolut
	if (has('completed date') && has('amount') && has('state')) {
		return {
			confident: true,
			mapping: { preset: 'Revolut', cols: { date: col(['completed date']), amount: col(['amount']), description: col(['description']) } }
		};
	}
	// bunq
	if (has('interest date') && has('counterparty')) {
		return {
			confident: true,
			mapping: {
				preset: 'bunq',
				cols: { date: col(['date']), amount: col(['amount']), account: col(['account']), counterAccount: col(['counterparty']), counterparty: col(['name']), description: col(['description']) }
			}
		};
	}

	// Generiek
	const used: number[] = [];
	const pick = (f: BankField) => {
		const i = col(SYN[f], used);
		if (i >= 0) used.push(i);
		return i;
	};
	const cols: BankMapping['cols'] = {};
	for (const f of ['date', 'amount', 'direction', 'counterAccount', 'account', 'counterparty', 'description', 'description2'] as BankField[]) cols[f] = pick(f);
	const confident = (cols.date ?? -1) >= 0 && (cols.amount ?? -1) >= 0;
	return { confident, mapping: { preset: 'Generiek', cols } };
}

export interface BankTx {
	id: string;
	date: string; // YYYY-MM-DD
	amount: number; // + = inkomsten, - = uitgaven
	counterparty: string;
	counterAccount: string;
	account: string;
	description: string;
}

/** Simpele hash zodat dezelfde transactie niet dubbel wordt geïmporteerd. */
function hash(s: string) {
	let h = 5381;
	for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
	return (h >>> 0).toString(36);
}

export function buildBankTx(t: CsvTable, m: BankMapping): { tx: BankTx[]; skipped: number } {
	const c = m.cols;
	const get = (r: string[], f: BankField) => (c[f] != null && c[f]! >= 0 ? (r[c[f]!] ?? '').trim() : '');
	const dec = c.amount != null && c.amount >= 0 ? detectDecimal(t.rows.map((r) => r[c.amount!])) : undefined;
	const tx: BankTx[] = [];
	let skipped = 0;
	const seen = new Map<string, number>();
	for (const r of t.rows) {
		const date = parseDate(get(r, 'date'));
		let amount = parseNumber(get(r, 'amount'), dec);
		if (!date || amount == null) {
			skipped++;
			continue;
		}
		const dir = norm(get(r, 'direction'));
		if (dir) {
			if (/^(af|debet|debit|d)$/.test(dir)) amount = -Math.abs(amount);
			else if (/^(bij|credit|c)$/.test(dir)) amount = Math.abs(amount);
		}
		const description = [get(r, 'description'), get(r, 'description2')].filter(Boolean).join(' ').replace(/\s+/g, ' ');
		let counterparty = get(r, 'counterparty');
		if (!counterparty && m.preset.startsWith('ABN')) counterparty = abnName(description);
		const base = `${date}|${amount}|${counterparty}|${description}|${get(r, 'account')}`;
		const n = (seen.get(base) ?? 0) + 1;
		seen.set(base, n);
		tx.push({
			id: hash(base + '#' + n),
			date,
			amount,
			counterparty: counterparty || description.slice(0, 40),
			counterAccount: get(r, 'counterAccount').replace(/\s/g, '').toUpperCase(),
			account: get(r, 'account').replace(/\s/g, '').toUpperCase(),
			description
		});
	}
	return { tx, skipped };
}

/** ABN AMRO zet de naam in de omschrijving: "/TRTP/SEPA OVERBOEKING/IBAN/.../NAME/Jan Jansen/REMI/..." */
function abnName(desc: string): string {
	const m = desc.match(/\/NAME\/([^/]+)/i);
	if (m) return m[1].trim();
	const m2 = desc.match(/^(?:BEA|GEA)[^,]*?\s{2,}(.+?),/);
	if (m2) return m2[1].trim();
	return desc.slice(0, 40);
}

export function parseBankFile(text: string) {
	const table = readCsv(text);
	return { table, ...detectBank(table) };
}
