import {
	WOONQUOTE,
	NHG_GRENS,
	NHG_GRENS_ENERGIE,
	NHG_PROVISIE,
	STARTERSVRIJSTELLING_GRENS,
	STARTERS_MAX_LEEFTIJD,
	OVERDRACHTSBELASTING_EIGEN,
	BRONNEN_2026 as B,
	annuiteit,
	leningBijMaandlast,
	aftrekTarief,
	EIGENWONINGFORFAIT
} from './fiscaal2026';
import type { Tip } from './types';

/**
 * Hypotheek & koophuis (doorontwikkeld uit Lazul Finance, normen 2026).
 * Maximale hypotheek = maandlast volgens Nibud-woonquote, terugrekend met de toetsrente over 30 jaar.
 */

export interface HypotheekData {
	situatie: 'eerste_koop' | 'doorstromer' | 'oversluiten';
	leeftijd: number | null;
	brutoInkomen: number | null;
	partnerInkomen: number | null;
	duoTermijn: number | null; // maandtermijn studieschuld
	andereLeningen: number | null; // maandlast overige kredieten
	woningprijs: number | null;
	eigenGeld: number | null;
	overwaarde: number | null; // doorstromer
	rente: number; // % op jaarbasis
	rentevast: 5 | 10 | 20 | 30;
	aflossing: 'annuitair' | 'lineair';
	energieBesparend: number | null; // budget voor verduurzaming
	// oversluiten
	huidigSaldo: number | null;
	huidigeRente: number | null;
	restlooptijd: number | null;
	boeterente: number | null;
}

export const emptyHypotheek = (leeftijd: number | null = null, inkomen: number | null = null): HypotheekData => ({
	situatie: 'eerste_koop',
	leeftijd,
	brutoInkomen: inkomen,
	partnerInkomen: null,
	duoTermijn: null,
	andereLeningen: null,
	woningprijs: null,
	eigenGeld: null,
	overwaarde: null,
	rente: 3.9,
	rentevast: 10,
	aflossing: 'annuitair',
	energieBesparend: null,
	huidigSaldo: null,
	huidigeRente: null,
	restlooptijd: null,
	boeterente: null
});

function woonquote(inkomen: number, rente: number): number {
	const col = (r: (typeof WOONQUOTE)[number]) => (rente <= 3.5 ? r.q35 : rente <= 4.0 ? r.q35 + ((rente - 3.5) / 0.5) * (r.q40 - r.q35) : rente <= 4.5 ? r.q40 + ((rente - 4) / 0.5) * (r.q45 - r.q40) : r.q45);
	if (inkomen <= WOONQUOTE[0].inkomen) return col(WOONQUOTE[0]) * Math.max(0.6, inkomen / WOONQUOTE[0].inkomen);
	for (let i = 0; i < WOONQUOTE.length - 1; i++) {
		const a = WOONQUOTE[i];
		const b = WOONQUOTE[i + 1];
		if (inkomen <= b.inkomen) return col(a) + ((inkomen - a.inkomen) / (b.inkomen - a.inkomen)) * (col(b) - col(a));
	}
	return col(WOONQUOTE[WOONQUOTE.length - 1]);
}

export interface HypotheekResultaat {
	toetsinkomen: number;
	toetsrente: number;
	woonquote: number;
	maxMaandlast: number;
	maxHypotheek: number;
	maxWoningwaarde: number;
	lening: number;
	ltv: number;
	kostenKoper: number;
	overdrachtsbelasting: number;
	startersvrijstelling: boolean;
	nhg: boolean;
	nhgKosten: number;
	maandBruto: number;
	maandNetto: number;
	lineairStart: number;
	lineairEind: number;
	totaleRenteAnnuitair: number;
	totaleRenteLineair: number;
	past: boolean;
	tekortEigenGeld: number;
	oversluiten: { besparing: number; kosten: number; terugverdienMaanden: number | null } | null;
	oordeel: 'groen' | 'oranje' | 'rood';
	tips: Tip[];
	verloop: { jaar: number; schuldAnnuitair: number; schuldLineair: number }[];
}

export function berekenHypotheek(d: HypotheekData): HypotheekResultaat {
	d = { ...d, rente: Math.min(15, Math.max(0, d.rente ?? 0)) };

	const n = (v: number | null | undefined) => (v == null || !isFinite(v) ? 0 : v);
	const tips: Tip[] = [];
	const toetsinkomen = n(d.brutoInkomen) + n(d.partnerInkomen);
	// bij rentevast < 10 jaar toetsen banken tegen minimaal 5%
	const toetsrente = d.rentevast < 10 ? Math.max(5, d.rente) : d.rente;
	const wq = woonquote(toetsinkomen, toetsrente);
	// studieschuld en andere leningen verlagen de ruimte (indicatief: bruto-equivalent van de maandlast)
	const correctie = n(d.duoTermijn) * 1.35 + n(d.andereLeningen) * 1.35;
	const maxMaandlast = Math.max(0, (toetsinkomen * wq) / 12 - correctie);
	const maxHypotheek = Math.round(leningBijMaandlast(maxMaandlast, toetsrente / 100, 30) / 1000) * 1000;

	const prijs = n(d.woningprijs);
	const eigen = n(d.eigenGeld) + (d.situatie === 'doorstromer' ? n(d.overwaarde) : 0);
	const starters = d.situatie === 'eerste_koop' && n(d.leeftijd) > 0 && n(d.leeftijd) <= STARTERS_MAX_LEEFTIJD && prijs > 0 && prijs <= STARTERSVRIJSTELLING_GRENS;
	const overdrachtsbelasting = d.situatie === 'oversluiten' || starters ? 0 : Math.round(prijs * OVERDRACHTSBELASTING_EIGEN);
	const overigeKosten = d.situatie === 'oversluiten' ? 2_500 : prijs > 0 ? Math.round(4_500 + prijs * 0.005) : 0; // notaris, taxatie, advies, bankgarantie
	const kostenKoper = overdrachtsbelasting + overigeKosten;
	// kosten koper zijn niet mee te financieren → moeten uit eigen geld; eigen geld gaat eerst naar kosten koper
	const eigenNaKosten = eigen - kostenKoper;
	const leningNodig = d.situatie === 'oversluiten' ? n(d.huidigSaldo) : Math.max(0, prijs + n(d.energieBesparend) - Math.max(0, eigenNaKosten));
	const tekortEigenGeld = d.situatie === 'oversluiten' ? 0 : Math.max(0, kostenKoper - eigen);
	const ltv = prijs > 0 ? leningNodig / prijs : 0;
	const nhgGrens = n(d.energieBesparend) > 0 ? NHG_GRENS_ENERGIE : NHG_GRENS;
	const nhg = d.situatie !== 'oversluiten' && leningNodig > 0 && leningNodig <= nhgGrens && prijs <= nhgGrens;
	const nhgKosten = nhg ? Math.round(leningNodig * NHG_PROVISIE) : 0;

	const r = d.rente / 100;
	const maandBruto = annuiteit(leningNodig, r, 30);
	// netto: rente is aftrekbaar (tegen max. 37,56%), eigenwoningforfait wordt bijgeteld
	const renteJaar1 = leningNodig * r;
	const aftrek = Math.max(0, renteJaar1 - prijs * EIGENWONINGFORFAIT) * aftrekTarief(Math.max(n(d.brutoInkomen), n(d.partnerInkomen)));
	const maandNetto = maandBruto - aftrek / 12;
	const lineairStart = leningNodig / 360 + (leningNodig * r) / 12;
	const lineairEind = leningNodig / 360 + ((leningNodig / 360) * r) / 12;
	const totaleRenteAnnuitair = maandBruto * 360 - leningNodig;
	const totaleRenteLineair = ((leningNodig * r) / 12) * ((360 + 1) / 2);

	// schuldverloop
	const verloop: HypotheekResultaat['verloop'] = [];
	let sa = leningNodig;
	for (let jaar = 0; jaar <= 30; jaar++) {
		verloop.push({ jaar, schuldAnnuitair: Math.max(0, sa), schuldLineair: Math.max(0, leningNodig - (leningNodig / 30) * jaar) });
		for (let m = 0; m < 12; m++) sa = sa * (1 + r / 12) - maandBruto;
	}

	const past = d.situatie === 'oversluiten' || leningNodig <= maxHypotheek;

	// oversluiten
	let oversluiten: HypotheekResultaat['oversluiten'] = null;
	if (d.situatie === 'oversluiten' && n(d.huidigSaldo) > 0 && d.huidigeRente) {
		const rest = n(d.restlooptijd) || 25;
		const nu = annuiteit(n(d.huidigSaldo), d.huidigeRente / 100, rest);
		const nieuw = annuiteit(n(d.huidigSaldo), r, rest);
		const besparing = nu - nieuw;
		const kosten = n(d.boeterente) + 2_500;
		oversluiten = { besparing, kosten, terugverdienMaanden: besparing > 0 ? Math.ceil(kosten / besparing) : null };
	}

	// ── tips
	const eur = (v: number) => `€ ${Math.round(v).toLocaleString('nl-NL')}`;
	if (d.situatie !== 'oversluiten' && prijs > 0) {
		if (!past)
			tips.push({ prioriteit: 'hoog', titel: 'Je gewenste lening is hoger dan je maximale hypotheek', tekst: `Op basis van je inkomen kun je ongeveer ${eur(maxHypotheek)} lenen; je hebt ${eur(leningNodig)} nodig. Verschil: ${eur(leningNodig - maxHypotheek)}. Meer eigen geld, een partnerinkomen of een goedkopere woning sluit dat gat.`, links: [B.nibudHypotheek] });
		else
			tips.push({ prioriteit: 'laag', titel: 'De lening past binnen je maximale hypotheek', tekst: `Ruimte over: ${eur(maxHypotheek - leningNodig)}. Leen niet meer dan nodig: elke € 10.000 extra kost bij ${d.rente.toLocaleString('nl-NL')}% rente ± ${eur(annuiteit(10_000, r, 30))} per maand.`, links: [B.afmHypotheek] });
		if (tekortEigenGeld > 0)
			tips.push({ prioriteit: 'hoog', titel: `Je komt ${eur(tekortEigenGeld)} eigen geld tekort voor de kosten koper`, tekst: `Kosten koper (± ${eur(kostenKoper)}) kun je niet meefinancieren. Spaar dit bedrag eerst bij elkaar, of vraag een schenking van ouders.`, links: [B.overdracht] });
		if (starters)
			tips.push({ prioriteit: 'gemiddeld', titel: 'Je hebt recht op de startersvrijstelling', tekst: `Je bent jonger dan 35 en de woning kost niet meer dan ${eur(STARTERSVRIJSTELLING_GRENS)}: je betaalt geen overdrachtsbelasting. Dat scheelt ${eur(prijs * OVERDRACHTSBELASTING_EIGEN)}. De vrijstelling kun je één keer gebruiken.`, links: [B.overdracht] });
		else if (d.situatie === 'eerste_koop' && n(d.leeftijd) <= STARTERS_MAX_LEEFTIJD && prijs > STARTERSVRIJSTELLING_GRENS)
			tips.push({ prioriteit: 'gemiddeld', titel: 'Net boven de startersgrens', tekst: `Boven ${eur(STARTERSVRIJSTELLING_GRENS)} vervalt de startersvrijstelling volledig en betaal je 2% (${eur(prijs * 0.02)}). Een woning net onder de grens kan dus voordeliger zijn.`, links: [B.overdracht] });
		if (nhg)
			tips.push({ prioriteit: 'gemiddeld', titel: 'NHG is mogelijk', tekst: `De lening valt onder de NHG-grens van ${eur(nhgGrens)}. Je betaalt eenmalig ${eur(nhgKosten)} (0,4%) en krijgt meestal een lagere rente plus een vangnet bij werkloosheid, scheiding of overlijden.`, links: [B.nhg] });
		else if (leningNodig > NHG_GRENS)
			tips.push({ prioriteit: 'laag', titel: 'Boven de NHG-grens', tekst: 'Zonder NHG is een ruime buffer belangrijker. Overweeg een woonlastenverzekering en bespreek arbeidsongeschiktheid met je adviseur.', links: [B.nhg] });
		if (ltv > 1)
			tips.push({ prioriteit: 'hoog', titel: `Je leent meer dan de woningwaarde (${Math.round(ltv * 100)}%)`, tekst: 'Maximaal 100% van de woningwaarde is toegestaan (plus verduurzaming). Je hebt meer eigen geld nodig.', links: [B.afmHypotheek] });
		else if (ltv <= 0.8 && ltv > 0)
			tips.push({ prioriteit: 'laag', titel: `Lage verhouding lening/waarde (${Math.round(ltv * 100)}%)`, tekst: 'Onder de 80% (en zeker onder 60%) krijg je bij de meeste banken een lagere rente. Vraag hier expliciet naar.', links: [B.afmHypotheek] });
		if (d.rentevast < 10)
			tips.push({ prioriteit: 'gemiddeld', titel: 'Korte rentevaste periode: toetsing op 5%', tekst: 'Bij een rentevaste periode korter dan 10 jaar rekent de bank met minimaal 5% rente. Daardoor kun je minder lenen. Een rentevaste periode van 10 jaar of langer geeft meer leenruimte en zekerheid.', links: [B.nibudHypotheek] });
		if (n(d.duoTermijn) > 0)
			tips.push({ prioriteit: 'gemiddeld', titel: 'Studieschuld telt mee', tekst: `Je DUO-termijn van ${eur(n(d.duoTermijn))} per maand verlaagt je leenruimte met ongeveer ${eur(leningBijMaandlast(n(d.duoTermijn) * 1.35, toetsrente / 100, 30))}. Geef je studieschuld altijd op: banken controleren dit.`, links: [B.duo] });
		tips.push({ prioriteit: 'laag', titel: 'Verduurzamen kan extra leenruimte geven', tekst: 'Afhankelijk van het energielabel mag je extra lenen voor energiebesparende maatregelen, bovenop je normale maximum. Bij een zuinig label kan ook je gewone leenruimte hoger uitvallen. Vraag ook naar een groene hypotheekkorting op de rente.', links: [B.nibudHypotheek] });
	}
	if (oversluiten) {
		if (oversluiten.besparing > 0 && (oversluiten.terugverdienMaanden ?? 999) <= 60)
			tips.push({ prioriteit: 'hoog', titel: `Oversluiten loont: ± ${eur(oversluiten.besparing)} per maand`, tekst: `De kosten (boeterente + ± € 2.500 advies/notaris = ${eur(oversluiten.kosten)}) heb je in ± ${oversluiten.terugverdienMaanden} maanden terugverdiend.`, links: [B.afmHypotheek] });
		else
			tips.push({ prioriteit: 'gemiddeld', titel: 'Oversluiten lijkt nu niet voordelig', tekst: oversluiten.besparing <= 0 ? 'De huidige rente is niet lager dan je eigen rente.' : `Terugverdientijd ± ${oversluiten.terugverdienMaanden} maanden: lang. Vraag je bank naar de exacte boeterente; die is vaak lager dan gedacht als je de 10–20% boetevrije aflossing eerst benut.`, links: [B.afmHypotheek] });
		tips.push({ prioriteit: 'laag', titel: 'Vraag eerst je eigen bank om renteverlaging', tekst: 'Is je lening ten opzichte van de woningwaarde gedaald (door aflossen of waardestijging)? Dan zit je mogelijk in een lagere risicoklasse. Dat kost niets.', links: [B.wozloket] });
	}

	const oordeel: HypotheekResultaat['oordeel'] = d.situatie === 'oversluiten' ? (oversluiten && oversluiten.besparing > 0 ? 'groen' : 'oranje') : !past || tekortEigenGeld > 0 || ltv > 1 ? 'rood' : leningNodig > maxHypotheek * 0.9 ? 'oranje' : 'groen';

	return {
		toetsinkomen,
		toetsrente,
		woonquote: wq,
		maxMaandlast,
		maxHypotheek,
		maxWoningwaarde: maxHypotheek + Math.max(0, eigenNaKosten),
		lening: leningNodig,
		ltv,
		kostenKoper,
		overdrachtsbelasting,
		startersvrijstelling: starters,
		nhg,
		nhgKosten,
		maandBruto,
		maandNetto,
		lineairStart,
		lineairEind,
		totaleRenteAnnuitair,
		totaleRenteLineair,
		past,
		tekortEigenGeld,
		oversluiten,
		oordeel,
		tips,
		verloop
	};
}
