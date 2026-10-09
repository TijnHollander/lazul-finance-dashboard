import type { Tip } from './types';
import { BRONNEN_2026 as B } from './fiscaal2026';

/**
 * Spaardoelen & financiële onafhankelijkheid (FIRE).
 *  - Per doel: benodigde maandinleg; doelen ≥ 5 jaar weg rekenen met beleggingsrendement, korter met spaarrente.
 *  - FIRE-getal = jaaruitgaven / opnamepercentage (standaard 4%, de "4%-regel" uit de Trinity-studie).
 */

export interface Spaardoel {
	id: string;
	naam: string;
	bedrag: number | null;
	datum: string; // YYYY-MM
	gespaard: number | null;
}

export interface DoelenData {
	doelen: Spaardoel[];
	maandUitgaven: number | null;
	vermogen: number | null; // beleggingen + spaargeld voor FIRE
	maandInleg: number | null;
	leeftijd: number | null;
	opname: number; // %
	rendement: number; // % reëel beleggen
	spaarrente: number; // %
	vrijeRuimte: number | null; // wat er per maand over is (uit rapport/bank)
}

export const emptyDoelen = (): DoelenData => ({
	doelen: [
		{ id: 'buffer', naam: 'Noodbuffer', bedrag: 6000, datum: plusMaanden(12), gespaard: 0 },
		{ id: 'vakantie', naam: 'Vakantie', bedrag: 2000, datum: plusMaanden(9), gespaard: 0 }
	],
	maandUitgaven: null,
	vermogen: null,
	maandInleg: null,
	leeftijd: null,
	opname: 4,
	rendement: 5,
	spaarrente: 2,
	vrijeRuimte: null
});

export function plusMaanden(m: number): string {
	const d = new Date();
	d.setMonth(d.getMonth() + m);
	return d.toISOString().slice(0, 7);
}

function maandenTot(ym: string): number {
	const [y, m] = ym.split('-').map(Number);
	const now = new Date();
	return Math.max(1, (y - now.getFullYear()) * 12 + (m - 1 - now.getMonth()));
}

export interface DoelResultaat {
	doel: Spaardoel;
	maanden: number;
	beleggen: boolean;
	perMaand: number;
	voortgang: number;
}

export interface DoelenResultaat {
	doelen: DoelResultaat[];
	totaalPerMaand: number;
	pastInRuimte: boolean | null;
	fireGetal: number;
	jarenTotFire: number | null;
	fireLeeftijd: number | null;
	coastFire: number;
	isCoast: boolean;
	pad: { jaar: number; vermogen: number; doel: number }[];
	tips: Tip[];
}

export function berekenDoelen(d: DoelenData): DoelenResultaat {
	d = { ...d, rendement: Math.min(12, Math.max(0, d.rendement ?? 0)), spaarrente: Math.min(10, Math.max(0, d.spaarrente ?? 0)), opname: Math.min(10, Math.max(1, d.opname || 4)) };

	const n = (v: number | null) => v ?? 0;
	const eur = (v: number) => `€ ${Math.round(v).toLocaleString('nl-NL')}`;
	const doelen: DoelResultaat[] = d.doelen
		.filter((x) => n(x.bedrag) > 0)
		.map((doel) => {
			const maanden = maandenTot(doel.datum);
			const beleggen = maanden >= 60;
			const r = (beleggen ? d.rendement : d.spaarrente) / 100 / 12;
			const rest = Math.max(0, n(doel.bedrag) - n(doel.gespaard) * Math.pow(1 + r, maanden));
			const perMaand = r === 0 ? rest / maanden : (rest * r) / (Math.pow(1 + r, maanden) - 1);
			return { doel, maanden, beleggen, perMaand, voortgang: Math.min(1, n(doel.gespaard) / n(doel.bedrag)) };
		})
		.sort((a, b) => a.maanden - b.maanden);
	const totaalPerMaand = doelen.reduce((a, x) => a + x.perMaand, 0);
	const pastInRuimte = d.vrijeRuimte == null ? null : totaalPerMaand <= d.vrijeRuimte;

	// FIRE
	const jaarUitgaven = n(d.maandUitgaven) * 12;
	const fireGetal = d.opname > 0 ? jaarUitgaven / (d.opname / 100) : 0;
	const r = d.rendement / 100;
	let v = n(d.vermogen);
	let jarenTotFire: number | null = null;
	const pad: DoelenResultaat['pad'] = [];
	for (let jaar = 0; jaar <= 60; jaar++) {
		pad.push({ jaar, vermogen: v, doel: fireGetal });
		if (jarenTotFire == null && fireGetal > 0 && v >= fireGetal) jarenTotFire = jaar;
		for (let m = 0; m < 12; m++) v = v * (1 + r / 12) + n(d.maandInleg);
		if (jarenTotFire != null && jaar > jarenTotFire + 5) break;
	}
	const leeftijd = n(d.leeftijd);
	const fireLeeftijd = jarenTotFire != null && leeftijd ? leeftijd + jarenTotFire : null;
	// Coast FIRE: genoeg nu om zonder extra inleg op 67 het FIRE-getal te halen
	const jarenTot67 = leeftijd ? Math.max(0, 67 - leeftijd) : 30;
	const coastFire = fireGetal / Math.pow(1 + r, jarenTot67);
	const isCoast = n(d.vermogen) >= coastFire && fireGetal > 0;

	const tips: Tip[] = [];
	if (pastInRuimte === false)
		tips.push({ prioriteit: 'hoog', titel: 'Je doelen passen niet in je maandruimte', tekst: `Je doelen vragen ${eur(totaalPerMaand)} per maand; je houdt ± ${eur(n(d.vrijeRuimte))} over. Schuif een doel naar achteren, verlaag het bedrag of kijk in "Besparen" waar ruimte zit.`, links: [] });
	if (doelen.some((x) => x.beleggen))
		tips.push({ prioriteit: 'laag', titel: 'Lange doelen: beleggen in plaats van sparen', tekst: `Doelen die 5 jaar of verder weg liggen rekenen we met ${d.rendement}% beleggingsrendement. Dat scheelt flink in de maandinleg, maar de uitkomst is niet gegarandeerd.`, links: [{ label: 'AFM – Is beleggen iets voor jou?', url: 'https://www.afm.nl/nl-nl/consumenten/themas/zelf-beleggen/is-beleggen-iets-voor-jou' }] });
	if (fireGetal > 0)
		tips.push({ prioriteit: 'gemiddeld', titel: `Jouw FIRE-getal: ${eur(fireGetal)}`, tekst: `Met ${eur(jaarUitgaven)} uitgaven per jaar en ${d.opname}% opname per jaar heb je ${eur(fireGetal)} nodig om van je vermogen te leven. Elke € 100 per maand minder uitgeven verlaagt dit doel met ${eur((1200 / (d.opname / 100)))}.`, links: [{ label: 'Trinity-studie (4%-regel)', url: 'https://en.wikipedia.org/wiki/Trinity_study' }] });
	if (isCoast)
		tips.push({ prioriteit: 'laag', titel: 'Je hebt Coast FIRE bereikt', tekst: `Zonder nog iets in te leggen groeit je vermogen naar verwachting tot je FIRE-getal op je 67e. Alles wat je nu extra inlegt, brengt de datum naar voren.`, links: [] });
	tips.push({ prioriteit: 'laag', titel: 'Box 3 telt mee', tekst: 'Boven het heffingsvrij vermogen betaal je vermogensrendementsheffing; reken voor FIRE met een iets lager netto rendement.', links: [B.box3] });

	return { doelen, totaalPerMaand, pastInRuimte, fireGetal, jarenTotFire, fireLeeftijd, coastFire, isCoast, pad, tips };
}
