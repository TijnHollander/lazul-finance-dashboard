import { AOW_NETTO, AOW_LEEFTIJD, JAARRUIMTE_MAX, BRONNEN_2026 as B, aftrekTarief } from './fiscaal2026';
import type { Tip } from './types';

/**
 * Pensioen & AOW-gat.
 * Doel-inkomen na pensioen (netto p/m) − AOW − verwacht pensioen = gat.
 * Benodigd kapitaal = contante waarde van het gat tot de levensverwachting; daaruit volgt de maandelijkse inleg.
 */

export interface PensioenData {
	leeftijd: number | null;
	nettoInkomen: number | null; // nu per maand
	brutoJaar: number | null;
	samenwonend: boolean;
	doelPercentage: number; // % van huidig netto
	verwachtPensioen: number | null; // bruto per jaar uit mijnpensioenoverzicht (exclusief AOW)
	eigenVermogen: number | null; // al opzij voor pensioen (lijfrente, beleggingen)
	maandInleg: number | null; // wat je nu al zelf inlegt
	aowLeeftijd: number;
	stopLeeftijd: number; // eerder stoppen?
	rendement: number; // % reëel
	levensverwachting: number;
}

export const emptyPensioen = (leeftijd: number | null = null, netto: number | null = null): PensioenData => ({
	leeftijd,
	nettoInkomen: netto,
	brutoJaar: null,
	samenwonend: false,
	doelPercentage: 70,
	verwachtPensioen: null,
	eigenVermogen: null,
	maandInleg: null,
	aowLeeftijd: AOW_LEEFTIJD + (leeftijd != null && leeftijd < 45 ? 1 : 0),
	stopLeeftijd: AOW_LEEFTIJD + (leeftijd != null && leeftijd < 45 ? 1 : 0),
	rendement: 3.5,
	levensverwachting: 90
});

export interface PensioenResultaat {
	doelNetto: number;
	aow: number;
	pensioenNetto: number;
	gat: number;
	benodigdKapitaal: number;
	kapitaalStraks: number;
	tekortKapitaal: number;
	maandNodig: number;
	jarenTotStop: number;
	belastingvoordeelLijfrente: number;
	opbouw: { leeftijd: number; nu: number; nodig: number }[];
	tips: Tip[];
}

export function berekenPensioen(d: PensioenData): PensioenResultaat {
	d = { ...d, rendement: Math.min(12, Math.max(-2, d.rendement ?? 0)), doelPercentage: Math.min(150, Math.max(0, d.doelPercentage ?? 70)), stopLeeftijd: Math.min(d.aowLeeftijd || 67, Math.max(30, d.stopLeeftijd || 67)) };

	const n = (v: number | null) => v ?? 0;
	const eur = (v: number) => `€ ${Math.round(v).toLocaleString('nl-NL')}`;
	const leeftijd = n(d.leeftijd) || 30;
	const doelNetto = (n(d.nettoInkomen) * d.doelPercentage) / 100;
	const aow = d.samenwonend ? AOW_NETTO.samen : AOW_NETTO.alleen;
	// pensioen is belast; ruwe netto-schatting ~78% voor modale pensioenen
	const pensioenNetto = (n(d.verwachtPensioen) / 12) * 0.78;
	// eerder stoppen: jaren zonder AOW volledig zelf financieren
	const gat = Math.max(0, doelNetto - aow - pensioenNetto);
	const vroegJaren = Math.max(0, d.aowLeeftijd - d.stopLeeftijd);
	const r = d.rendement / 100;
	const rm = r / 12;
	const pv = (maand: number, jaren: number) => (jaren <= 0 ? 0 : rm === 0 ? maand * jaren * 12 : (maand * (1 - Math.pow(1 + rm, -jaren * 12))) / rm);
	const jarenNaAow = Math.max(0, d.levensverwachting - d.aowLeeftijd);
	// kapitaal nodig op stopleeftijd
	const kapitaalVroeg = pv(Math.max(0, doelNetto - pensioenNetto), vroegJaren);
	const kapitaalNaAow = pv(gat, jarenNaAow) / Math.pow(1 + r, vroegJaren);
	const benodigdKapitaal = kapitaalVroeg + kapitaalNaAow;
	const jarenTotStop = Math.max(0, d.stopLeeftijd - leeftijd);
	const fv = (pvNu: number, maand: number, jaren: number) => {
		let k = pvNu;
		for (let m = 0; m < jaren * 12; m++) k = k * (1 + rm) + maand;
		return k;
	};
	const kapitaalStraks = fv(n(d.eigenVermogen), n(d.maandInleg), jarenTotStop);
	const tekortKapitaal = Math.max(0, benodigdKapitaal - kapitaalStraks);
	const factor = jarenTotStop > 0 ? (rm === 0 ? jarenTotStop * 12 : (Math.pow(1 + rm, jarenTotStop * 12) - 1) / rm) : 0;
	const maandNodig = factor > 0 ? tekortKapitaal / factor : tekortKapitaal;
	const belastingvoordeelLijfrente = Math.min(maandNodig * 12, JAARRUIMTE_MAX) * aftrekTarief(n(d.brutoJaar));

	const opbouw: PensioenResultaat['opbouw'] = [];
	let kNu = n(d.eigenVermogen);
	let kNodig = n(d.eigenVermogen);
	for (let a = leeftijd; a <= d.stopLeeftijd; a++) {
		opbouw.push({ leeftijd: a, nu: kNu, nodig: kNodig });
		for (let m = 0; m < 12; m++) {
			kNu = kNu * (1 + rm) + n(d.maandInleg);
			kNodig = kNodig * (1 + rm) + n(d.maandInleg) + maandNodig;
		}
	}

	const tips: Tip[] = [];
	if (!d.verwachtPensioen)
		tips.push({ prioriteit: 'hoog', titel: 'Vul je verwachte pensioen in', tekst: 'Op mijnpensioenoverzicht.nl (inloggen met DigiD) zie je in 5 minuten wat je bij al je werkgevers hebt opgebouwd en wat je verwacht te krijgen. Zonder dat getal is deze berekening te somber.', links: [B.mpo] });
	if (gat > 0 && maandNodig > 0)
		tips.push({ prioriteit: 'hoog', titel: `Pensioengat: ± ${eur(gat)} per maand`, tekst: `Om na je ${d.stopLeeftijd}e ${eur(doelNetto)} netto per maand te hebben, moet je ± ${eur(maandNodig)} per maand extra opzij zetten (bij ${d.rendement.toLocaleString('nl-NL')}% reëel rendement).`, links: [B.mpo] });
	else tips.push({ prioriteit: 'laag', titel: 'Je pensioen lijkt op koers', tekst: 'Met je AOW, opgebouwd pensioen en huidige inleg haal je je doel. Check dit elk jaar opnieuw.', links: [B.mpo] });
	if (maandNodig > 0 && n(d.brutoJaar) > 0)
		tips.push({ prioriteit: 'gemiddeld', titel: 'Gebruik je jaarruimte: inleg is aftrekbaar', tekst: `Leg je via een lijfrente- of bankspaarrekening in, dan krijg je ${Math.round(aftrekTarief(n(d.brutoJaar)) * 1000) / 10}% terug van de Belastingdienst. Op ${eur(maandNodig * 12)} per jaar is dat ± ${eur(belastingvoordeelLijfrente)}. Bij uitkering betaal je wel belasting, vaak tegen een lager tarief.`, voordeel: `± ${eur(belastingvoordeelLijfrente)} per jaar`, links: [B.lijfrente] });
	if (vroegJaren > 0)
		tips.push({ prioriteit: 'gemiddeld', titel: `Eerder stoppen: ${vroegJaren} jaar zonder AOW`, tekst: `Tussen ${d.stopLeeftijd} en ${d.aowLeeftijd} betaal je alles zelf. Dat kost ± ${eur(kapitaalVroeg)} extra kapitaal.`, links: [B.svb] });
	tips.push({ prioriteit: 'laag', titel: 'Check je AOW-leeftijd', tekst: `De AOW-leeftijd is ${AOW_LEEFTIJD} en stijgt mee met de levensverwachting. Voor wie nu jonger is dan 45 is 68 of later waarschijnlijk.`, links: [B.svb] });

	return { doelNetto, aow, pensioenNetto, gat, benodigdKapitaal, kapitaalStraks, tekortKapitaal, maandNodig, jarenTotStop, belastingvoordeelLijfrente, opbouw, tips };
}
