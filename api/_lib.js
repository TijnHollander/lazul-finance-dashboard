// Gedeelde helpers voor de Vercel-functies (bestanden met _ worden geen endpoint).
export const UA =
	'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

export function query(req) {
	const url = new URL(req.url, 'http://localhost');
	return Object.fromEntries(url.searchParams.entries());
}

export function send(res, status, body, maxAge = 60) {
	res.statusCode = status;
	res.setHeader('Content-Type', 'application/json; charset=utf-8');
	res.setHeader('Cache-Control', `public, s-maxage=${maxAge}, stale-while-revalidate=${maxAge * 5}`);
	res.setHeader('Access-Control-Allow-Origin', '*');
	res.end(JSON.stringify(body));
}

export async function getJson(url) {
	const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
	if (!r.ok) throw new Error(`HTTP ${r.status} voor ${url}`);
	return r.json();
}

export async function getText(url) {
	const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/rss+xml, application/xml, text/xml, */*' } });
	if (!r.ok) throw new Error(`HTTP ${r.status} voor ${url}`);
	return r.text();
}

export function cleanSymbols(s, max = 40) {
	return [...new Set(String(s || '').split(',').map((x) => x.trim().toUpperCase()).filter((x) => /^[A-Z0-9.^=\-]{1,20}$/.test(x)))].slice(0, max);
}
