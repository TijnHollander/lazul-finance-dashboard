import Papa from 'papaparse';

export interface CsvTable {
	headers: string[];
	rows: string[][];
	delimiter: string;
	hasHeader: boolean;
}

/** Leest een CSV/TAB-bestand. Detecteert scheidingsteken en of er een kopregel is. */
export function readCsv(text: string): CsvTable {
	text = text.replace(/^﻿/, '');
	const firstLine = text.split(/\r?\n/)[0] ?? '';
	const counts = { ';': 0, ',': 0, '\t': 0 } as Record<string, number>;
	for (const ch of firstLine) if (ch in counts) counts[ch]++;
	const delimiter = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][1] > 0
		? Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]
		: ',';
	const res = Papa.parse<string[]>(text, { delimiter, skipEmptyLines: 'greedy' });
	const all = (res.data as string[][]).map((r) => r.map((c) => (c ?? '').trim()));
	if (!all.length) return { headers: [], rows: [], delimiter, hasHeader: false };

	// Kopregel als de eerste rij grotendeels uit tekst bestaat (geen bedragen/datums).
	const first = all[0];
	const looksData = first.filter((c) => c && (parseNumber(c) != null || parseDate(c) != null)).length;
	const hasHeader = looksData <= Math.max(1, Math.floor(first.length / 3));
	let headers: string[];
	let rows: string[][];
	if (hasHeader) {
		headers = first.map((h, i) => h || `Kolom ${i + 1}`);
		// Lege kopjes (DEGIRO gebruikt die voor valuta) een naam geven op basis van de vorige kolom
		headers = headers.map((h, i) => (first[i] ? h : `${first[i - 1] || 'Kolom'} (valuta ${i + 1})`));
		rows = all.slice(1);
	} else {
		headers = first.map((_, i) => `Kolom ${i + 1}`);
		rows = all;
	}
	const width = headers.length;
	rows = rows.filter((r) => r.some((c) => c !== '')).map((r) => (r.length < width ? [...r, ...Array(width - r.length).fill('')] : r));
	return { headers, rows, delimiter, hasHeader };
}

/** Normaliseert een kolomnaam: kleine letters, zonder accenten/leestekens. */
export function norm(s: string): string {
	return s
		.toLowerCase()
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.replace(/[^a-z0-9/ ]+/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

/** Zoekt de eerste kolom waarvan de genormaliseerde naam overeenkomt met één van de synoniemen. */
export function findCol(headers: string[], synonyms: string[], exclude: number[] = []): number {
	const H = headers.map(norm);
	// eerst exacte match, dan "begint met", dan "bevat"
	for (const mode of ['exact', 'starts', 'contains'] as const) {
		for (const syn of synonyms) {
			const s = norm(syn);
			const idx = H.findIndex((h, i) => {
				if (exclude.includes(i)) return false;
				if (mode === 'exact') return h === s;
				if (mode === 'starts') return h.startsWith(s);
				return s.length > 3 && h.includes(s);
			});
			if (idx >= 0) return idx;
		}
	}
	return -1;
}

/**
 * Robuust getallen lezen: "1.234,56", "1,234.56", "-12,50", "+12.5", "€ 10", "1 234,5".
 * decimal kan per kolom worden geforceerd als het formaat bekend is.
 */
export function parseNumber(raw: string | undefined | null, decimal?: ',' | '.'): number | null {
	if (raw == null) return null;
	let s = String(raw).trim();
	if (!s) return null;
	s = s.replace(/[€$£\s ]|EUR|USD|GBP/gi, '');
	let neg = false;
	if (/^\(.*\)$/.test(s)) {
		neg = true;
		s = s.slice(1, -1);
	}
	if (s.endsWith('-')) {
		neg = true;
		s = s.slice(0, -1);
	}
	if (!/^[+-]?[\d.,']+$/.test(s)) return null;
	s = s.replace(/'/g, '');
	const lastComma = s.lastIndexOf(',');
	const lastDot = s.lastIndexOf('.');
	let dec: ',' | '.' | null = decimal ?? null;
	if (!dec) {
		if (lastComma >= 0 && lastDot >= 0) dec = lastComma > lastDot ? ',' : '.';
		else if (lastComma >= 0) dec = (s.match(/,/g)!.length > 1) ? '.' : ',';
		else if (lastDot >= 0) dec = (s.match(/\./g)!.length > 1) ? ',' : '.';
		else dec = '.';
	}
	const thousands = dec === ',' ? '.' : ',';
	s = s.split(thousands).join('');
	if (dec === ',') s = s.replace(',', '.');
	const n = Number(s);
	if (!isFinite(n)) return null;
	return neg ? -Math.abs(n) : n;
}

/** Bepaalt het decimaalteken van een kolom op basis van alle waarden. */
export function detectDecimal(values: string[]): ',' | '.' | undefined {
	let comma = 0;
	let dot = 0;
	for (const v of values) {
		const s = (v ?? '').replace(/[^\d.,]/g, '');
		const lc = s.lastIndexOf(',');
		const ld = s.lastIndexOf('.');
		if (lc > ld && s.length - lc - 1 !== 3) comma++;
		else if (ld > lc && s.length - ld - 1 !== 3) dot++;
		else if (lc >= 0 && ld >= 0) lc > ld ? comma++ : dot++;
	}
	if (comma > dot) return ',';
	if (dot > comma) return '.';
	return undefined;
}

/** Leest datums in de gangbare bank- en brokerformaten. Geeft YYYY-MM-DD terug. */
export function parseDate(raw: string | undefined | null): string | null {
	if (!raw) return null;
	const s = raw.trim();
	let m: RegExpMatchArray | null;
	const ok = (y: number, mo: number, d: number) =>
		y > 1970 && y < 2100 && mo >= 1 && mo <= 12 && d >= 1 && d <= 31
			? `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
			: null;
	if ((m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/))) return ok(+m[1], +m[2], +m[3]);
	if ((m = s.match(/^(\d{4})(\d{2})(\d{2})$/))) return ok(+m[1], +m[2], +m[3]);
	if ((m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/))) return ok(+m[3], +m[2], +m[1]);
	if ((m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2})$/))) return ok(2000 + +m[3], +m[2], +m[1]);
	const MAAND: Record<string, number> = { jan: 1, feb: 2, mrt: 3, mar: 3, apr: 4, mei: 5, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, okt: 10, oct: 10, nov: 11, dec: 12 };
	if ((m = s.toLowerCase().match(/^(\d{1,2})[ -]([a-z]{3})[a-z]*\.?[ -](\d{4})/)) && MAAND[m[2]]) return ok(+m[3], MAAND[m[2]], +m[1]);
	return null;
}

export async function readFileText(file: File): Promise<string> {
	const buf = await file.arrayBuffer();
	// Probeer UTF-8; val terug op Windows-1252 (oudere bankexports)
	const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(buf);
	if (utf8.includes('�')) {
		try {
			return new TextDecoder('windows-1252').decode(buf);
		} catch {
			return utf8;
		}
	}
	return utf8;
}
