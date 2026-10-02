const eur0 = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const eur2 = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const num = new Intl.NumberFormat('nl-NL', { maximumFractionDigits: 4 });

export function euro(v: number | null | undefined, decimals = false): string {
	if (v == null || !isFinite(v)) return '—';
	return decimals ? eur2.format(v) : eur0.format(Math.round(v));
}

export function money(v: number | null | undefined, currency = 'EUR'): string {
	if (v == null || !isFinite(v)) return '—';
	try {
		return new Intl.NumberFormat('nl-NL', { style: 'currency', currency, maximumFractionDigits: 2 }).format(v);
	} catch {
		return `${v.toFixed(2)} ${currency}`;
	}
}

export function compactEuro(v: number): string {
	const a = Math.abs(v);
	if (a >= 1_000_000) return `€ ${(v / 1_000_000).toLocaleString('nl-NL', { maximumFractionDigits: 1 })} mln`;
	if (a >= 10_000) return `€ ${Math.round(v / 1000).toLocaleString('nl-NL')}k`;
	return euro(v);
}

export function pct(v: number | null | undefined, decimals = 1, sign = true): string {
	if (v == null || !isFinite(v)) return '—';
	const s = v.toLocaleString('nl-NL', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
	return `${sign && v > 0 ? '+' : ''}${s}%`;
}

export function qty(v: number): string {
	return num.format(v);
}

export function dateNl(d: string | Date): string {
	const dt = typeof d === 'string' ? new Date(d) : d;
	if (isNaN(dt.getTime())) return '—';
	return dt.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' });
}

const MAANDEN = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
export function monthLabel(key: string): string {
	const [y, m] = key.split('-');
	return `${MAANDEN[Number(m) - 1]} '${y.slice(2)}`;
}

export function timeAgo(iso: string | number): string {
	const t = typeof iso === 'number' ? iso : new Date(iso).getTime();
	const s = Math.round((Date.now() - t) / 1000);
	if (s < 60) return 'zojuist';
	if (s < 3600) return `${Math.floor(s / 60)} min geleden`;
	if (s < 86400) return `${Math.floor(s / 3600)} uur geleden`;
	const d = Math.floor(s / 86400);
	return d === 1 ? 'gisteren' : `${d} dagen geleden`;
}

export function uid(): string {
	return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}
