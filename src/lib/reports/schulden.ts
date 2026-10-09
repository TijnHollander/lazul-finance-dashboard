import type { Tip } from './types';
import { BRONNEN_2026 as B } from './fiscaal2026';

/**
 * Schulden-aflosplan.
 *  - Lawine: extra geld eerst naar de hoogste rente (goedkoopst).
 *  - Sneeuwbal: eerst de kleinste schuld (snelle successen, motiverend).
 *  - Alleen minimum: ter vergelijking.
 */

export interface Schuld {
	id: string;
	naam: string;
	soort: 'creditcard' | 'persoonlijk' | 'rood' | 'bnpl' | 'duo' | 'auto' | 'familie' | 'overig';
	saldo: number | null;
	rente: number | null; // % per jaar
	termijn: number | null; // minimale maandtermijn
}

export interface SchuldenData {
	schulden: Schuld[];
	extra: number | null; // extra per maand
}

export const SOORT_LABEL: Record<Schuld['soort'], string> = {
	creditcard: 'Creditcard',
	persoonlijk: 'Persoonlijke lening',
	rood: 'Rood staan',
	bnpl: 'Achteraf betalen (Klarna e.d.)',
	duo: 'Studieschuld (DUO)',
	auto: 'Auto / private lease',
	familie: 'Familie / vrienden',
	overig: 'Overig'
};

export const SOORT_RENTE: Record<Schuld['soort'], number> = {
	creditcard: 14,
	persoonlijk: 8,
	rood: 12,
	bnpl: 14,
	duo: 2.5,
	auto: 7,
	familie: 0,
	overig: 8
};

export const emptySchulden = (): SchuldenData => ({ schulden: [], extra: 50 });

/** Rente begrenzen op 0–30% (hoger kan in Nederland wettelijk niet bij consumptief krediet; max. kredietvergoeding ligt rond 14%). */
export const renteVan = (x: Schuld) => Math.min(30, Math.max(0, x.rente ?? 0));

/** Schatting van de minimale maandtermijn als die niet is ingevuld. */
export function geschatteTermijn(x: Schuld): number {
	const saldo = x.saldo ?? 0;
	const r = renteVan(x) / 100 / 12;
	const annu = (jaren: number) => (r === 0 ? saldo / (jaren * 12) : (saldo * r) / (1 - Math.pow(1 + r, -jaren * 12)));
	switch (x.soort) {
		case 'creditcard':
		case 'rood':
			return Math.max(25, saldo * 0.03);
		case 'bnpl':
			return saldo / 3;
		case 'duo':
			return annu(35);
		case 'familie':
			return saldo / 24;
		case 'auto':
			return annu(4);
		default:
			return annu(5);
	}
}
export const termijnVan = (x: Schuld) => (x.termijn != null && x.termijn > 0 ? x.termijn : geschatteTermijn(x));

export interface Scenario {
	naam: string;
	maanden: number | null;
	totaleRente: number;
	verloop: number[]; // totale schuld per maand
	volgorde: string[];
}

function simuleer(schulden: Schuld[], extra: number, sorteer: (a: Schuld, b: Schuld) => number, naam: string): Scenario {
	const s = schulden.map((x) => ({ ...x, rente: renteVan(x), termijn: termijnVan(x), rest: x.saldo ?? 0 })).filter((x) => x.rest > 0);
	let totaleRente = 0;
	const verloop: number[] = [s.reduce((a, x) => a + x.rest, 0)];
	const volgorde: string[] = [];
	const budget = s.reduce((a, x) => a + (x.termijn ?? 0), 0) + extra;
	let maand = 0;
	while (s.some((x) => x.rest > 0.5) && maand < 600) {
		maand++;
		let beschikbaar = budget;
		// rente bijschrijven en minimumtermijnen betalen
		for (const x of s) {
			if (x.rest <= 0) continue;
			const r = (x.rente ?? 0) / 100 / 12;
			const rente = x.rest * r;
			totaleRente += rente;
			x.rest += rente;
			const betaal = Math.min(x.rest, x.termijn ?? 0);
			x.rest -= betaal;
			beschikbaar -= betaal;
		}
		// rest naar de prioriteitsschuld
		const open = s.filter((x) => x.rest > 0.5).sort(sorteer);
		for (const x of open) {
			if (beschikbaar <= 0) break;
			const betaal = Math.min(x.rest, beschikbaar);
			x.rest -= betaal;
			beschikbaar -= betaal;
		}
		for (const x of s) if (x.rest <= 0.5 && !volgorde.includes(x.naam)) volgorde.push(x.naam);
		verloop.push(s.reduce((a, x) => a + Math.max(0, x.rest), 0));
	}
	return { naam, maanden: maand < 600 ? maand : null, totaleRente, verloop, volgorde };
}

export interface SchuldenResultaat {
	totaal: number;
	gemRente: number;
	minimum: Scenario;
	lawine: Scenario;
	sneeuwbal: Scenario;
	besparing: number;
	tips: Tip[];
}

export function berekenSchulden(d: SchuldenData): SchuldenResultaat {
	const eur = (v: number) => `€ ${Math.round(v).toLocaleString('nl-NL')}`;
	const geldig = d.schulden.filter((x) => (x.saldo ?? 0) > 0);
	const totaal = geldig.reduce((a, x) => a + (x.saldo ?? 0), 0);
	const gemRente = totaal ? geldig.reduce((a, x) => a + (x.saldo ?? 0) * renteVan(x), 0) / totaal : 0;
	// DUO telt niet mee in versneld aflossen: lage rente, draagkrachtregeling
	const zonderDuo = geldig.filter((x) => x.soort !== 'duo');
	const extra = d.extra ?? 0;
	const minimum = simuleer(geldig, 0, () => 0, 'Alleen minimum');
	const lawine = simuleer(zonderDuo.length ? zonderDuo : geldig, extra, (a, b) => (b.rente ?? 0) - (a.rente ?? 0), 'Lawine (hoogste rente eerst)');
	const sneeuwbal = simuleer(zonderDuo.length ? zonderDuo : geldig, extra, (a, b) => (a.saldo ?? 0) - (b.saldo ?? 0), 'Sneeuwbal (kleinste eerst)');
	const minZonderDuo = simuleer(zonderDuo.length ? zonderDuo : geldig, 0, () => 0, '');
	const besparing = minZonderDuo.totaleRente - lawine.totaleRente;

	const tips: Tip[] = [];
	const nietAflossend = geldig.filter((x) => termijnVan(x) * 12 <= (x.saldo ?? 0) * (renteVan(x) / 100));
	const teHoog = geldig.filter((x) => (x.rente ?? 0) > 30);
	if (teHoog.length)
		tips.push({ prioriteit: 'hoog', titel: 'Controleer de rente', tekst: `${teHoog.map((x) => `${x.naam} (${x.rente}%)`).join(', ')}: dat is onrealistisch hoog. We rekenen met maximaal 30%. Bedoelde je misschien het openstaande bedrag?`, links: [] });
	const geschat = geldig.filter((x) => !(x.termijn && x.termijn > 0));
	if (geschat.length)
		tips.push({ prioriteit: 'laag', titel: 'Minimale termijn geschat', tekst: `Voor ${geschat.map((x) => x.naam).join(', ')} heb je geen maandtermijn ingevuld; we gebruiken een gangbare schatting. Vul je echte termijn in voor een nauwkeurig plan.`, links: [] });
	if (nietAflossend.length)
		tips.push({ prioriteit: 'hoog', titel: 'Een schuld groeit in plaats van te krimpen', tekst: `Bij ${nietAflossend.map((x) => x.naam).join(', ')} is de maandtermijn niet hoger dan de rente. Zonder extra aflossen raak je deze schuld nooit kwijt.`, links: [B.geldfit] });
	const duur = geldig.filter((x) => renteVan(x) >= 10);
	if (duur.length)
		tips.push({ prioriteit: 'hoog', titel: 'Begin bij de dure schulden', tekst: `${duur.map((x) => `${x.naam} (${renteVan(x)}%)`).join(', ')}: dit soort rente is hoger dan wat beleggen gemiddeld oplevert. Elke extra euro hier is een gegarandeerd "rendement" van ${Math.max(...duur.map(renteVan))}%.`, links: [B.geldfit] });
	if (geldig.some((x) => x.soort === 'duo'))
		tips.push({ prioriteit: 'laag', titel: 'Studieschuld apart houden', tekst: 'DUO rekent een lage rente en je betaalt naar draagkracht. We nemen hem niet mee in het versneld aflossen; los eerst duurdere schulden af en bouw een buffer op.', links: [B.duo] });
	if (geldig.some((x) => x.soort === 'bnpl'))
		tips.push({ prioriteit: 'gemiddeld', titel: 'Stop met achteraf betalen', tekst: 'Achteraf betalen voelt gratis, maar bij te laat betalen volgen hoge kosten en het maakt uitgaven onzichtbaar. Zet het uit in je apps.', links: [] });
	if (lawine.maanden != null && sneeuwbal.maanden != null)
		tips.push({ prioriteit: 'gemiddeld', titel: lawine.totaleRente < sneeuwbal.totaleRente - 50 ? 'De lawinemethode bespaart de meeste rente' : 'Beide methodes zijn ongeveer even duur', tekst: `Lawine: schuldenvrij in ${lawine.maanden} maanden, ${eur(lawine.totaleRente)} rente. Sneeuwbal: ${sneeuwbal.maanden} maanden, ${eur(sneeuwbal.totaleRente)} rente. Kies sneeuwbal als je motivatie nodig hebt van snel een schuld afstrepen.`, links: [] });
	if (totaal > 0)
		tips.push({ prioriteit: 'laag', titel: 'Hulp nodig? Het is gratis en anoniem', tekst: 'Loop je achter met betalen of slaap je slecht van je schulden? Geldfit en de schuldhulp van je gemeente helpen gratis.', links: [B.geldfit] });

	return { totaal, gemRente, minimum, lawine, sneeuwbal, besparing, tips };
}
