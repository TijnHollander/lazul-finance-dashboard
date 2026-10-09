import type { BankTx } from './parsers/bank';
import { FIXED, NEUTRAL, ruleKey, type Category, type CashflowSummary } from './cashflow';
import { NIBUD_VOEDING } from './reports/fiscaal2026';

/**
 * Bespaarpatronen: kijkt naar je echte transacties en zoekt waar ruimte zit.
 * Alles draait lokaal; richtbedragen zijn vuistregels (voeding: Nibud).
 */

export interface Huishouden {
	volwassenen: number;
	kinderen: number;
}

export interface Benchmark {
	category: Category;
	avg: number;
	richt: number;
	basis: string;
	boven: number; // € per maand boven richtbedrag
}

export interface Abonnement {
	naam: string;
	bedrag: number;
	perJaar: number;
	maanden: number;
	category: Category;
	streaming: boolean;
	laatste: string;
}

export interface Trend {
	category: Category;
	perMaand: number; // stijging per maand in €
	start: number;
	eind: number;
}

export interface HorecaInzicht {
	perMaand: number;
	bezoekenPerMaand: number;
	gemBon: number;
	bezorgPct: number;
	weekendPct: number;
	top: { naam: string; totaal: number; keer: number }[];
	besparingEenMinderPerWeek: number;
}

export interface Inzicht {
	id: string;
	titel: string;
	tekst: string;
	besparing: number; // € per maand
	icon: string;
	tone: 'pos' | 'warn' | 'info';
}

export interface Verdeling {
	inkomen: number;
	nodig: number;
	wensen: number;
	sparen: number;
}

export interface BespaarAnalyse {
	benchmarks: Benchmark[];
	abonnementen: Abonnement[];
	trends: Trend[];
	horeca: HorecaInzicht | null;
	kleineAankopen: { perMaand: number; aantal: number };
	weekdag: number[]; // gem. variabele uitgaven per weekdag (ma..zo) per week
	salarisEffect: { naSalaris: number; normaal: number; pct: number } | null;
	verdeling: Verdeling;
	inkomenVariatie: number;
	extraInkomenMaanden: { key: string; extra: number }[];
	inzichten: Inzicht[];
	voorstel: Record<string, number>; // % minder per categorie
}

const WENS: Category[] = ['Uit eten & horeca', 'Winkelen', 'Vrije tijd & reizen', 'Overig', 'Contant geld'];
const STREAMING = /netflix|spotify|disney|videoland|hbo|max\.com|prime video|amazon prime|apple\.com|youtube|viaplay|dazn|ziggo sport|npo plus|deezer|audible|storytel/i;
const BEZORG = /thuisbezorgd|uber ?eats|deliveroo|just eat|flink|getir|gorillas/i;

function richtbedragen(h: Huishouden, inkomen: number): Partial<Record<Category, { bedrag: number; basis: string }>> {
	const voeding = h.volwassenen >= 2 ? NIBUD_VOEDING.basis2 + (h.volwassenen - 2) * 220 : NIBUD_VOEDING.basis1;
	return {
		Boodschappen: { bedrag: voeding + h.kinderen * NIBUD_VOEDING.perKind, basis: 'Nibud-richtbedrag voeding' },
		'Uit eten & horeca': { bedrag: Math.max(75, inkomen * 0.05), basis: 'vuistregel: max. 5% van je inkomen' },
		Winkelen: { bedrag: Math.max(80, inkomen * 0.06), basis: 'vuistregel: max. 6% van je inkomen' },
		'Telecom & abonnementen': { bedrag: 70 + (h.volwassenen - 1) * 35 + h.kinderen * 15, basis: 'vuistregel: telefoon, internet en 2–3 abonnementen' },
		'Vrije tijd & reizen': { bedrag: Math.max(100, inkomen * 0.08), basis: 'vuistregel: max. 8% van je inkomen' },
		Vervoer: { bedrag: Math.max(100, inkomen * 0.1), basis: 'vuistregel: max. 10% van je inkomen' },
		Wonen: { bedrag: inkomen * 0.35, basis: 'vuistregel: max. 35% van je netto inkomen' },
		'Energie & water': { bedrag: 140 + (h.volwassenen + h.kinderen - 1) * 30, basis: 'gemiddelde energierekening (indicatie)' }
	};
}

/** Theil-Sen-helling: mediaan van alle paarsgewijze hellingen, ongevoelig voor één uitschieter (zoals een vakantie). */
function slope(ys: number[]): number {
	const n = ys.length;
	if (n < 3) return 0;
	const sl: number[] = [];
	for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) sl.push((ys[j] - ys[i]) / (j - i));
	sl.sort((a, b) => a - b);
	return sl[Math.floor(sl.length / 2)];
}

export function analyseer(tx: BankTx[], cats: Map<string, Category>, s: CashflowSummary, h: Huishouden): BespaarAnalyse {
	const months = s.used.map((m) => m.key);
	const inPeriod = new Set(months);
	const ptx = tx.filter((t) => inPeriod.has(t.date.slice(0, 7)));
	const nM = Math.max(1, months.length);
	const inkomen = s.wAvgIncome;
	const cat = (t: BankTx) => cats.get(t.id) ?? 'Overig';

	// ── benchmarks
	const richt = richtbedragen(h, inkomen);
	const benchmarks: Benchmark[] = [];
	for (const c of s.categoryAvg) {
		const r = richt[c.category];
		if (!r) continue;
		benchmarks.push({ category: c.category, avg: c.avg, richt: r.bedrag, basis: r.basis, boven: Math.max(0, c.avg - r.bedrag) });
	}
	benchmarks.sort((a, b) => b.boven - a.boven);

	// ── abonnementen: zelfde tegenpartij, (bijna) elke maand, vrijwel zelfde bedrag
	const groepen = new Map<string, BankTx[]>();
	for (const t of tx) {
		if (t.amount >= 0) continue;
		const c = cat(t);
		if (NEUTRAL.includes(c) || c === 'Wonen' || c === 'Contant geld') continue;
		const k = ruleKey(t);
		if (!groepen.has(k)) groepen.set(k, []);
		groepen.get(k)!.push(t);
	}
	const allMonths = [...new Set(tx.map((t) => t.date.slice(0, 7)))].length;
	const abonnementen: Abonnement[] = [];
	for (const list of groepen.values()) {
		const perMaand = new Map<string, number>();
		for (const t of list) perMaand.set(t.date.slice(0, 7), (perMaand.get(t.date.slice(0, 7)) ?? 0) - t.amount);
		const bedragen = [...perMaand.values()];
		if (perMaand.size < Math.min(3, Math.max(2, allMonths - 1))) continue;
		if (list.length > perMaand.size * 1.3) continue; // meerdere keren per maand → geen abonnement
		const gem = bedragen.reduce((a, b) => a + b, 0) / bedragen.length;
		const sd = Math.sqrt(bedragen.reduce((a, b) => a + (b - gem) ** 2, 0) / bedragen.length);
		const spreiding = (Math.max(...bedragen) - Math.min(...bedragen)) / gem;
		if (gem < 2 || sd / gem > 0.05 || spreiding > 0.1) continue;
		const t0 = list[list.length - 1];
		const c = cat(t0);
		abonnementen.push({ naam: t0.counterparty, bedrag: gem, perJaar: gem * 12, maanden: perMaand.size, category: c, streaming: STREAMING.test(`${t0.counterparty} ${t0.description}`), laatste: list.map((t) => t.date).sort().at(-1)! });
	}
	abonnementen.sort((a, b) => b.bedrag - a.bedrag);

	// ── trends per categorie
	const trends: Trend[] = [];
	if (s.used.length >= 3) {
		const catNames = new Set(s.categoryAvg.map((c) => c.category));
		for (const c of catNames) {
			if (NEUTRAL.includes(c)) continue;
			const ys = s.used.map((m) => -(m.byCategory[c] ?? 0));
			const sl = slope(ys);
			const avg = ys.reduce((a, b) => a + b, 0) / ys.length;
			if (sl > 10 && sl > avg * 0.06) trends.push({ category: c, perMaand: sl, start: ys[0], eind: ys[ys.length - 1] });
		}
		trends.sort((a, b) => b.perMaand - a.perMaand);
	}

	// ── horeca
	const hTx = ptx.filter((t) => cat(t) === 'Uit eten & horeca' && t.amount < 0);
	let horeca: HorecaInzicht | null = null;
	if (hTx.length) {
		const totaal = hTx.reduce((a, t) => a - t.amount, 0);
		const bezorg = hTx.filter((t) => BEZORG.test(`${t.counterparty} ${t.description}`)).reduce((a, t) => a - t.amount, 0);
		const weekend = hTx.filter((t) => [0, 5, 6].includes(new Date(t.date).getDay())).reduce((a, t) => a - t.amount, 0);
		const top = new Map<string, { naam: string; totaal: number; keer: number }>();
		for (const t of hTx) {
			const k = t.counterparty.replace(/\s+\d+$/, '');
			const e = top.get(k) ?? { naam: k, totaal: 0, keer: 0 };
			e.totaal -= t.amount;
			e.keer++;
			top.set(k, e);
		}
		const gemBon = totaal / hTx.length;
		horeca = {
			perMaand: totaal / nM,
			bezoekenPerMaand: hTx.length / nM,
			gemBon,
			bezorgPct: totaal ? bezorg / totaal : 0,
			weekendPct: totaal ? weekend / totaal : 0,
			top: [...top.values()].sort((a, b) => b.totaal - a.totaal).slice(0, 5),
			besparingEenMinderPerWeek: Math.min((totaal / nM) * 0.4, gemBon * (hTx.length / nM >= 8 ? 4.33 : 2))
		};
	}

	// ── kleine aankopen (< € 15, horeca/boodschappen/overig)
	const klein = ptx.filter((t) => t.amount < 0 && -t.amount < 15 && ['Uit eten & horeca', 'Boodschappen', 'Overig', 'Winkelen'].includes(cat(t)));
	const kleineAankopen = { perMaand: klein.reduce((a, t) => a - t.amount, 0) / nM, aantal: klein.length / nM };

	// ── weekdag-patroon (variabele uitgaven)
	const weekdagTot = [0, 0, 0, 0, 0, 0, 0];
	for (const t of ptx) {
		const c = cat(t);
		if (t.amount >= 0 || FIXED.includes(c) || NEUTRAL.includes(c)) continue;
		const wd = (new Date(t.date).getDay() + 6) % 7; // ma=0
		weekdagTot[wd] -= t.amount;
	}
	const weken = Math.max(1, (nM * 30.4) / 7);
	const weekdag = weekdagTot.map((v) => v / weken);

	// ── salaris-effect: variabele uitgaven in de 7 dagen na salaris vs. gemiddeld
	let salarisEffect: BespaarAnalyse['salarisEffect'] = null;
	const salaris = ptx.filter((t) => cat(t) === 'Salaris & werk' && t.amount > 0);
	if (salaris.length >= 2) {
		const variabel = ptx.filter((t) => t.amount < 0 && !FIXED.includes(cat(t)) && !NEUTRAL.includes(cat(t)));
		const dagen = new Set<string>();
		for (const sTx of salaris) {
			const d0 = new Date(sTx.date);
			for (let i = 0; i < 7; i++) {
				const d = new Date(d0);
				d.setDate(d.getDate() + i);
				dagen.add(d.toISOString().slice(0, 10));
			}
		}
		const na = variabel.filter((t) => dagen.has(t.date)).reduce((a, t) => a - t.amount, 0) / salaris.length;
		const totaalVar = variabel.reduce((a, t) => a - t.amount, 0);
		const normaal = (totaalVar / (nM * 30.4)) * 7;
		if (normaal > 0) salarisEffect = { naSalaris: na, normaal, pct: na / normaal - 1 };
	}

	// ── 50/30/20
	let nodig = 0;
	let wensen = 0;
	for (const c of s.categoryAvg) {
		if (NEUTRAL.includes(c.category)) continue;
		if (WENS.includes(c.category)) wensen += c.avg;
		else nodig += c.avg;
	}
	const verdeling: Verdeling = { inkomen, nodig, wensen, sparen: Math.max(0, inkomen - nodig - wensen) };

	// ── inkomen
	const inc = s.used.map((m) => m.income);
	const gemInk = inc.reduce((a, b) => a + b, 0) / Math.max(1, inc.length);
	const sdInk = Math.sqrt(inc.reduce((a, b) => a + (b - gemInk) ** 2, 0) / Math.max(1, inc.length));
	const inkomenVariatie = gemInk ? sdInk / gemInk : 0;
	const med = [...inc].sort((a, b) => a - b)[Math.floor(inc.length / 2)] ?? 0;
	const extraInkomenMaanden = s.used.filter((m) => m.income > med * 1.3).map((m) => ({ key: m.key, extra: m.income - med }));

	// ── voorstel: breng categorieën boven het richtbedrag terug (max. 35% minder)
	const voorstel: Record<string, number> = {};
	for (const b of benchmarks) {
		if (b.boven <= 10 || FIXED.includes(b.category)) continue;
		voorstel[b.category] = Math.max(5, Math.min(25, Math.round(((b.boven / b.avg) * 100) / 5) * 5));
	}

	// ── inzichten (gesorteerd op besparing)
	const eur = (v: number) => `€ ${Math.round(v).toLocaleString('nl-NL')}`;
	const inzichten: Inzicht[] = [];
	if (horeca && horeca.perMaand > (richt['Uit eten & horeca']?.bedrag ?? 0)) {
		inzichten.push({
			id: 'horeca',
			icon: 'star',
			tone: 'warn',
			titel: `Uit eten & drinken: ${eur(horeca.perMaand)} per maand`,
			tekst: `Gemiddeld ${horeca.bezoekenPerMaand.toFixed(0)} keer per maand, ${eur(horeca.gemBon)} per keer${horeca.bezorgPct > 0.25 ? `; ${Math.round(horeca.bezorgPct * 100)}% is bezorging` : ''}${horeca.weekendPct > 0.6 ? `; ${Math.round(horeca.weekendPct * 100)}% valt in het weekend` : ''}. ${horeca.bezoekenPerMaand >= 8 ? 'Eén keer per week' : 'Twee keer per maand'} minder scheelt ± ${eur(horeca.besparingEenMinderPerWeek)} per maand.`,
			besparing: horeca.besparingEenMinderPerWeek
		});
	}
	const streaming = abonnementen.filter((a) => a.streaming);
	if (streaming.length >= 2) {
		const goedkoopste = Math.min(...streaming.map((a) => a.bedrag));
		inzichten.push({ id: 'streaming', icon: 'news', tone: 'warn', titel: `${streaming.length} streamingdiensten tegelijk`, tekst: `${streaming.map((a) => a.naam).join(', ')}. Wissel per maand van dienst in plaats van alles tegelijk: je kijkt toch niet alles.`, besparing: streaming.reduce((a, s) => a + s.bedrag, 0) - goedkoopste });
	}
	const abTotaal = abonnementen.reduce((a, b) => a + b.bedrag, 0);
	if (abonnementen.length >= 3)
		inzichten.push({ id: 'abonnementen', icon: 'refresh', tone: 'info', titel: `${abonnementen.length} vaste afschrijvingen: ${eur(abTotaal * 12)} per jaar`, tekst: 'Loop de lijst hieronder door. Gebruik je alles nog? Opzeggen kan bij de meeste diensten maandelijks.', besparing: abTotaal * 0.15 });
	if (salarisEffect && salarisEffect.pct > 0.3)
		inzichten.push({ id: 'salaris', icon: 'wallet', tone: 'warn', titel: `In de week na je salaris geef je ${Math.round(salarisEffect.pct * 100)}% meer uit`, tekst: `Gemiddeld ${eur(salarisEffect.naSalaris)} in die week, tegen ${eur(salarisEffect.normaal)} in een normale week. Tip: zet op je salarisdag automatisch eerst je spaarbedrag apart ("pay yourself first"). Wat je niet ziet, geef je niet uit.`, besparing: (salarisEffect.naSalaris - salarisEffect.normaal) * 0.5 });
	if (kleineAankopen.aantal >= 12)
		inzichten.push({ id: 'klein', icon: 'search', tone: 'info', titel: `${Math.round(kleineAankopen.aantal)} kleine aankopen per maand (< € 15)`, tekst: `Samen ${eur(kleineAankopen.perMaand)} per maand: koffie, snacks, even snel iets halen. Belegd tegen 6% is dat na 10 jaar ± ${eur(kleineAankopen.perMaand * 163.9)}.`, besparing: kleineAankopen.perMaand * 0.4 });
	for (const t of trends.slice(0, 2))
		inzichten.push({ id: `trend-${t.category}`, icon: 'chart', tone: 'warn', titel: `${t.category} stijgt elke maand`, tekst: `Van ${eur(t.start)} naar ${eur(t.eind)}: gemiddeld ${eur(t.perMaand)} per maand erbij. Zo sluipt "lifestyle creep" erin.`, besparing: t.perMaand * 3 });
	const bood = benchmarks.find((b) => b.category === 'Boodschappen');
	if (bood && bood.boven > 40)
		inzichten.push({ id: 'boodschappen', icon: 'wallet', tone: 'info', titel: `Boodschappen ${eur(bood.boven)} boven het Nibud-richtbedrag`, tekst: `Jij: ${eur(bood.avg)}, richtbedrag voor jouw huishouden: ± ${eur(bood.richt)}. Maaltijdplanning, huismerken en één grote boodschap per week schelen vaak 15–20%.`, besparing: bood.boven * 0.5 });
	if (verdeling.inkomen > 0 && verdeling.sparen / verdeling.inkomen < 0.1)
		inzichten.push({ id: 'spaarquote', icon: 'alert', tone: 'warn', titel: `Je spaart ${Math.round((verdeling.sparen / verdeling.inkomen) * 100)}% van je inkomen`, tekst: 'Het Nibud adviseert minimaal 10%; met de 50/30/20-regel is 20% het doel. Begin klein: verhoog je automatische spaaropdracht elke maand met € 25.', besparing: 0 });
	if (extraInkomenMaanden.length)
		inzichten.push({ id: 'extra', icon: 'plus', tone: 'pos', titel: 'Extra inkomen: geef het een bestemming vóórdat het binnenkomt', tekst: `In ${extraInkomenMaanden.map((m) => m.key).join(', ')} kreeg je ± ${eur(extraInkomenMaanden.reduce((a, m) => a + m.extra, 0))} extra (vakantiegeld, bonus, teruggaaf). Spreek met jezelf af: 50% naar beleggen of buffer, 50% om van te genieten.`, besparing: 0 });
	if (inkomenVariatie > 0.25)
		inzichten.push({ id: 'variatie', icon: 'info', tone: 'info', titel: 'Je inkomen schommelt sterk', tekst: `Variatie van ± ${Math.round(inkomenVariatie * 100)}% per maand. Budgetteer op je laagste maand en zet het surplus in goede maanden apart: een grotere buffer (4–6 maanden) geeft rust.`, besparing: 0 });
	inzichten.sort((a, b) => b.besparing - a.besparing);

	return { benchmarks, abonnementen, trends, horeca, kleineAankopen, weekdag, salarisEffect, verdeling, inkomenVariatie, extraInkomenMaanden, inzichten, voorstel };
}

/** Prognose: cumulatief overgehouden geld, nu vs. met bespaarplan, plus wat het belegd oplevert. */
export function prognose(overNu: number, besparing: number, maanden = 24, rendement = 0.06) {
	const rows: { maand: number; nu: number; plan: number; belegd: number }[] = [];
	let belegd = 0;
	for (let m = 0; m <= maanden; m++) {
		rows.push({ maand: m, nu: Math.max(0, overNu) * m, plan: (Math.max(0, overNu) + besparing) * m, belegd });
		belegd = belegd * (1 + rendement / 12) + besparing;
	}
	return rows;
}

/** Toekomstige waarde van een maandbedrag, belegd. */
export function fv(maand: number, jaren: number, rendement = 0.06) {
	const r = rendement / 12;
	return r === 0 ? maand * jaren * 12 : maand * ((Math.pow(1 + r, jaren * 12) - 1) / r);
}
