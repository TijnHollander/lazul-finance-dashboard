/**
 * Algemeen financieel rapport (doorontwikkeld uit Lazul Finance).
 *
 * Bronnen
 *  - CBS StatLine 83834NED, Vermogen van huishoudens (stand 1 jan 2024, voorlopig; gepubliceerd okt 2025)
 *  - Nibud: financiële buffer opbouwen
 *  - AFM: Is beleggen iets voor jou?
 *  - Belastingdienst: box 3 heffingsvrij vermogen 2026 (€ 59.357 p.p.)
 *  - DUO: studieschuld terugbetalen
 */

export type Werkstatus = 'loondienst' | 'zelfstandig' | 'student' | 'werkzoekend' | 'pensioen' | 'anders';
export type Woonsituatie = 'huur_sociaal' | 'huur_vrij' | 'koop' | 'bij_ouders' | 'anders';
export type Risico = 'laag' | 'gemiddeld' | 'hoog';
export type Doel = 'buffer' | 'huis' | 'pensioen' | 'vermogen' | 'schulden' | 'fire';

export interface RapportData {
	// 1 persoonlijk
	geboortejaar: number | null;
	samenwonend: boolean;
	kinderen: number;
	werkstatus: Werkstatus | null;
	woonsituatie: Woonsituatie | null;
	auto: boolean;
	// 2 inkomsten (netto per maand)
	nettoInkomen: number | null;
	partnerInkomen: number | null;
	jaarlijksExtra: number | null; // vakantiegeld/13e maand netto per jaar
	studiefinanciering: number | null; // gift: basisbeurs/aanvullende beurs
	studielening: number | null; // maandelijkse DUO-lening
	toeslagen: number | null;
	overigeInkomsten: number | null;
	// 3 vaste lasten
	woonlasten: number | null;
	energieWater: number | null;
	verzekeringen: number | null;
	abonnementen: number | null;
	vervoer: number | null;
	aflossingen: number | null;
	kinderopvangOverig: number | null;
	// 4 variabel
	boodschappen: number | null;
	horeca: number | null;
	winkelen: number | null;
	vrijeTijd: number | null;
	verzorging: number | null;
	overigVariabel: number | null;
	// 5 vermogen
	spaargeld: number | null;
	beleggingen: number | null;
	gebruikPortfolio: boolean;
	woningwaarde: number | null;
	hypotheek: number | null;
	studieschuld: number | null;
	overigeSchulden: number | null; // creditcard, persoonlijke lening, BNPL, rood staan
	// 6 doelen & risico
	doel: Doel | null;
	horizon: number | null; // jaren
	doelbedrag: number | null;
	reactieDaling: 'verkopen' | 'deels' | 'houden' | 'bijkopen' | null;
	ervaring: 'geen' | 'beetje' | 'ervaren' | null;
	risico: Risico | null; // afgeleid, maar door gebruiker aan te passen
}

export const emptyRapport = (geboortejaar: number | null = null): RapportData => ({
	geboortejaar,
	samenwonend: false,
	kinderen: 0,
	werkstatus: null,
	woonsituatie: null,
	auto: false,
	nettoInkomen: null,
	partnerInkomen: null,
	jaarlijksExtra: null,
	studiefinanciering: null,
	studielening: null,
	toeslagen: null,
	overigeInkomsten: null,
	woonlasten: null,
	energieWater: null,
	verzekeringen: null,
	abonnementen: null,
	vervoer: null,
	aflossingen: null,
	kinderopvangOverig: null,
	boodschappen: null,
	horeca: null,
	winkelen: null,
	vrijeTijd: null,
	verzorging: null,
	overigVariabel: null,
	spaargeld: null,
	beleggingen: null,
	gebruikPortfolio: true,
	woningwaarde: null,
	hypotheek: null,
	studieschuld: null,
	overigeSchulden: null,
	doel: null,
	horizon: null,
	doelbedrag: null,
	reactieDaling: null,
	ervaring: null,
	risico: null
});

// ───────────────────────────── CBS-vermogensdata
/** Bedragen × € 1.000, per leeftijd hoofdkostwinner. CBS 83834NED, 1 jan 2024 (voorlopig). */
export const CBS_PEILDATUM = '1 januari 2024';
export const CBS_URL = 'https://opendata.cbs.nl/statline/#/CBS/nl/dataset/83834NED/table';
export const CBS_GROUPS = [
	{ label: 'tot 25', min: 0, max: 24, mid: 22 },
	{ label: '25–35', min: 25, max: 34, mid: 30 },
	{ label: '35–45', min: 35, max: 44, mid: 40 },
	{ label: '45–55', min: 45, max: 54, mid: 50 },
	{ label: '55–65', min: 55, max: 64, mid: 60 },
	{ label: '65–75', min: 65, max: 74, mid: 70 },
	{ label: '75–85', min: 75, max: 84, mid: 80 },
	{ label: '85+', min: 85, max: 120, mid: 88 }
];
export type VermogenSoort = 'totaal' | 'exclWoning' | 'financieel';
export const VERMOGEN_LABEL: Record<VermogenSoort, string> = {
	totaal: 'Totaal vermogen',
	exclWoning: 'Vermogen excl. eigen woning',
	financieel: 'Financiële bezittingen (spaargeld + beleggingen)'
};
export const CBS: Record<VermogenSoort, { mean: number[]; median: number[] }> = {
	totaal: {
		mean: [24.9, 95.9, 246.4, 395.0, 487.0, 450.8, 417.9, 336.9],
		median: [0.3, 13.5, 120.1, 187.4, 250.2, 276.9, 265.3, 139.4]
	},
	exclWoning: {
		mean: [15.9, 41.5, 116.9, 215.8, 266.9, 213.3, 185.3, 144.5],
		median: [0.3, 5.1, 15.8, 28.3, 39.1, 41.1, 38.7, 35.5]
	},
	financieel: {
		mean: [13.9, 29.0, 45.7, 74.7, 103.3, 109.0, 111.5, 109.1],
		median: [3.7, 10.8, 16.5, 25.5, 35.1, 39.5, 38.4, 35.8]
	}
};

export function groupIndex(age: number) {
	return Math.max(0, CBS_GROUPS.findIndex((g) => age >= g.min && age <= g.max));
}

/** Geïnterpoleerde CBS-waarde (in euro) voor een exacte leeftijd, voor een vloeiende grafiek. */
export function cbsAt(age: number, soort: VermogenSoort, stat: 'mean' | 'median'): number {
	const xs = CBS_GROUPS.map((g) => g.mid);
	const ys = CBS[soort][stat];
	if (age <= xs[0]) return ys[0] * 1000;
	if (age >= xs[xs.length - 1]) return ys[ys.length - 1] * 1000;
	for (let i = 0; i < xs.length - 1; i++) {
		if (age >= xs[i] && age <= xs[i + 1]) {
			const t = (age - xs[i]) / (xs[i + 1] - xs[i]);
			return (ys[i] + t * (ys[i + 1] - ys[i])) * 1000;
		}
	}
	return 0;
}

// standaardnormale CDF
function phi(x: number) {
	const t = 1 / (1 + 0.2316419 * Math.abs(x));
	const d = 0.3989423 * Math.exp((-x * x) / 2);
	const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
	return x > 0 ? 1 - p : p;
}

/**
 * Schatting van je percentiel binnen je leeftijdsgroep.
 * CBS publiceert alleen gemiddelde en mediaan; we benaderen de verdeling met een lognormale verdeling
 * (gemiddelde/mediaan = e^(σ²/2)). Alleen zinvol voor positieve vermogens; dit is een indicatie.
 */
export function percentileEstimate(value: number, age: number, soort: VermogenSoort): number | null {
	const i = groupIndex(age);
	const med = CBS[soort].median[i] * 1000;
	const mean = CBS[soort].mean[i] * 1000;
	if (med <= 500 || mean <= med) return null;
	if (value <= 0) return 5;
	const sigma = Math.sqrt(2 * Math.log(mean / med));
	const p = phi((Math.log(value) - Math.log(med)) / sigma) * 100;
	return Math.min(99, Math.max(1, Math.round(p)));
}

// ───────────────────────────── berekening
export interface Suggestie {
	titel: string;
	tekst: string;
	bedrag?: number;
	links: { label: string; url: string }[];
}

export interface ETF {
	naam: string;
	ticker: string;
	isin: string;
	soort: 'aandelen' | 'obligaties';
	ter: string;
	waarom: string;
	url: string;
}

export const ETFS: ETF[] = [
	{
		naam: 'Vanguard FTSE All-World (acc.)',
		ticker: 'VWCE',
		isin: 'IE00BK5BQT80',
		soort: 'aandelen',
		ter: '± 0,2%',
		waarom: 'Ruim 3.500 bedrijven uit ontwikkelde én opkomende landen in één fonds. Herbelegt dividend automatisch.',
		url: 'https://www.justetf.com/nl/etf-profile.html?isin=IE00BK5BQT80'
	},
	{
		naam: 'iShares Core MSCI World',
		ticker: 'IWDA',
		isin: 'IE00B4L5Y983',
		soort: 'aandelen',
		ter: '0,20%',
		waarom: 'Ruim 1.300 grote en middelgrote bedrijven uit 23 ontwikkelde landen; een van de grootste en goedkoopste wereldtrackers.',
		url: 'https://www.justetf.com/nl/etf-profile.html?isin=IE00B4L5Y983'
	},
	{
		naam: 'VanEck Sustainable World Equal Weight',
		ticker: 'TSWE',
		isin: 'NL0010408704',
		soort: 'aandelen',
		ter: '0,20%',
		waarom: 'Nederlandse duurzame variant: 250 bedrijven met gelijke weging, dus minder afhankelijk van een paar techreuzen.',
		url: 'https://www.justetf.com/nl/etf-profile.html?isin=NL0010408704'
	},
	{
		naam: 'iShares Core Global Aggregate Bond (EUR hedged)',
		ticker: 'AGGH',
		isin: 'IE00BDBRDM35',
		soort: 'obligaties',
		ter: '0,10%',
		waarom: 'Duizenden staats- en bedrijfsobligaties wereldwijd, afgedekt naar euro. Dempt schommelingen van het aandelendeel.',
		url: 'https://www.justetf.com/nl/etf-profile.html?isin=IE00BDBRDM35'
	},
	{
		naam: 'iShares Core Euro Government Bond',
		ticker: 'IEGA',
		isin: 'IE00B4WXJJ64',
		soort: 'obligaties',
		ter: '0,07%',
		waarom: 'Alleen staatsobligaties van eurolanden; geen valutarisico. Geschikt als rustig deel van de portefeuille.',
		url: 'https://www.justetf.com/nl/etf-profile.html?isin=IE00B4WXJJ64'
	}
];

export const BRONNEN = {
	afm: { label: 'AFM – Is beleggen iets voor jou?', url: 'https://www.afm.nl/nl-nl/consumenten/themas/zelf-beleggen/is-beleggen-iets-voor-jou' },
	nibudBuffer: { label: 'Nibud – Financiële buffer opbouwen', url: 'https://www.nibud.nl/onderwerpen/sparen/een-financiele-buffer-opbouwen/' },
	spiva: { label: 'S&P SPIVA – actief vs. passief beleggen', url: 'https://www.spglobal.com/spdji/en/research-insights/spiva/' },
	box3: { label: 'Belastingdienst – Box 3', url: 'https://www.belastingdienst.nl/wps/wcm/connect/nl/box-3/box-3' },
	duo: { label: 'DUO – Studieschuld terugbetalen', url: 'https://duo.nl/particulier/studieschuld-terugbetalen/' },
	lijfrente: { label: 'Belastingdienst – Lijfrente & jaarruimte', url: 'https://www.belastingdienst.nl/wps/wcm/connect/bldcontentnl/belastingdienst/prive/werk_en_inkomen/lijfrente/aftrekken-lijfrentepremies/aftrekken-lijfrentepremies' },
	schuldhulp: { label: 'Geldfit – gratis hulp bij geldzorgen', url: 'https://www.geldfit.nl/' },
	cbs: { label: 'CBS StatLine – Vermogen van huishoudens', url: CBS_URL }
};

export const HEFFINGSVRIJ_2026 = 59_357;

export interface Resultaat {
	inkomen: number;
	inkomenGeleend: number;
	vasteLasten: number;
	variabel: number;
	uitgaven: number;
	vrijeRuimte: number;
	spaarquote: number;
	woonquote: number;
	buffer: { advies: number; huidig: number; maanden: number; status: 'te_laag' | 'voldoende' | 'ruim'; tekort: number; maandenTotVol: number | null };
	maandSparen: number;
	maandBeleggen: number;
	risico: Risico;
	verdeling: { aandelen: number; obligaties: number };
	score: number;
	scoreLabel: string;
	vermogen: { financieel: number; totaal: number; exclWoning: number; woningNetto: number; schulden: number };
	waarschuwingen: string[];
	tips: Suggestie[];
	etfs: ETF[];
	leeftijd: number | null;
}

const n = (v: number | null | undefined) => (v == null || !isFinite(v) ? 0 : v);

export function afgeleidRisico(d: RapportData): Risico {
	let p = 0;
	const h = n(d.horizon);
	if (h >= 15) p += 2;
	else if (h >= 7) p += 1;
	else if (h < 5) p -= 2;
	p += { verkopen: -2, deels: 0, houden: 1, bijkopen: 2 }[d.reactieDaling ?? 'deels'];
	p += { geen: -1, beetje: 0, ervaren: 1 }[d.ervaring ?? 'beetje'];
	if (p >= 3) return 'hoog';
	if (p >= 0) return 'gemiddeld';
	return 'laag';
}

export function bereken(d: RapportData, portfolioWaarde = 0): Resultaat {
	const leeftijd = d.geboortejaar ? new Date().getFullYear() - d.geboortejaar : null;
	const inkomenGeleend = n(d.studielening);
	const inkomen =
		n(d.nettoInkomen) + n(d.partnerInkomen) + n(d.jaarlijksExtra) / 12 + n(d.studiefinanciering) + inkomenGeleend + n(d.toeslagen) + n(d.overigeInkomsten);
	const vasteLasten = n(d.woonlasten) + n(d.energieWater) + n(d.verzekeringen) + n(d.abonnementen) + n(d.vervoer) + n(d.aflossingen) + n(d.kinderopvangOverig);
	const variabel = n(d.boodschappen) + n(d.horeca) + n(d.winkelen) + n(d.vrijeTijd) + n(d.verzorging) + n(d.overigVariabel);
	const uitgaven = vasteLasten + variabel;
	const vrijeRuimte = inkomen - uitgaven;
	const spaarquote = inkomen > 0 ? vrijeRuimte / inkomen : 0;
	const woonquote = inkomen > 0 ? n(d.woonlasten) / (inkomen - inkomenGeleend || inkomen) : 0;

	// ── buffer (indicatie op basis van Nibud-uitgangspunten)
	// vaste buffer voor onverwachte uitgaven (witgoed, reparaties) + inkomensbuffer in maanden uitgaven
	let vast = 2_500 + (d.samenwonend ? 1_000 : 0) + 750 * n(d.kinderen) + (d.woonsituatie === 'koop' ? 2_500 : 0) + (d.auto ? 1_500 : 0);
	if (d.woonsituatie === 'bij_ouders') vast = 1_500;
	const maandenInkomensbuffer = { zelfstandig: 6, loondienst: 2, student: 1, werkzoekend: 3, pensioen: 2, anders: 3 }[d.werkstatus ?? 'anders'];
	const adviesBuffer = Math.round((vast + maandenInkomensbuffer * uitgaven) / 100) * 100;
	const huidig = n(d.spaargeld);
	const status = huidig >= adviesBuffer * 1.5 ? 'ruim' : huidig >= adviesBuffer ? 'voldoende' : 'te_laag';
	const tekort = Math.max(0, adviesBuffer - huidig);

	// ── risico & verdeling
	const risico = d.risico ?? afgeleidRisico(d);
	const verdeling = risico === 'hoog' ? { aandelen: 90, obligaties: 10 } : risico === 'gemiddeld' ? { aandelen: 65, obligaties: 35 } : { aandelen: 35, obligaties: 65 };

	// ── sparen vs beleggen
	const dureSchuld = n(d.overigeSchulden) > 0;
	const korteHorizon = d.horizon != null && d.horizon < 5;
	let maandSparen = 0;
	let maandBeleggen = 0;
	if (vrijeRuimte > 0) {
		if (status === 'te_laag' || dureSchuld) {
			// eerst buffer en dure schulden; maximaal 20% alvast beleggen als buffer al > helft is
			const vooraf = !dureSchuld && huidig > adviesBuffer / 2 && !korteHorizon ? 0.2 : 0;
			maandBeleggen = vrijeRuimte * vooraf;
			maandSparen = vrijeRuimte - maandBeleggen;
		} else if (korteHorizon || d.doel === 'huis' && n(d.horizon) < 5) {
			maandSparen = vrijeRuimte;
		} else {
			const aandeel = { laag: 0.4, gemiddeld: 0.65, hoog: 0.8 }[risico];
			maandBeleggen = vrijeRuimte * aandeel;
			maandSparen = vrijeRuimte - maandBeleggen;
		}
	}
	maandSparen = Math.round(maandSparen);
	maandBeleggen = Math.round(maandBeleggen);
	const maandenTotVol = status === 'te_laag' ? (maandSparen > 0 ? Math.ceil(tekort / maandSparen) : null) : 0;

	// ── vermogen
	const beleggingen = n(d.beleggingen) + (d.gebruikPortfolio ? portfolioWaarde : 0);
	const financieel = huidig + beleggingen;
	const woningNetto = d.woonsituatie === 'koop' ? n(d.woningwaarde) - n(d.hypotheek) : 0;
	const schulden = n(d.studieschuld) + n(d.overigeSchulden);
	const totaal = financieel + woningNetto - schulden;
	const exclWoning = financieel - schulden;

	// ── score (0–100)
	let score = 50;
	if (spaarquote >= 0.2) score += 15;
	else if (spaarquote >= 0.1) score += 8;
	else if (spaarquote < 0) score -= 25;
	else if (spaarquote < 0.05) score -= 5;
	score += status === 'ruim' ? 15 : status === 'voldoende' ? 10 : huidig >= adviesBuffer / 2 ? 0 : -10;
	if (dureSchuld) score -= 15;
	else if (schulden === 0) score += 5;
	if (woonquote > 0.4) score -= 8;
	if (beleggingen > 0) score += 5;
	if (vasteLasten > 0 && inkomen > 0 && vasteLasten / inkomen > 0.6) score -= 7;
	score = Math.round(Math.min(100, Math.max(0, score)));
	const scoreLabel = score >= 80 ? 'Uitstekend' : score >= 65 ? 'Goed' : score >= 45 ? 'Redelijk' : score >= 25 ? 'Aandacht nodig' : 'Zorgelijk';

	// ── waarschuwingen
	const w: string[] = [];
	if (vrijeRuimte < 0) w.push(`Je geeft ${Math.round(-vrijeRuimte).toLocaleString('nl-NL')} euro per maand meer uit dan er binnenkomt. Dat is niet vol te houden; kijk eerst naar je grootste variabele posten.`);
	if (inkomenGeleend > 0) w.push(`${Math.round(inkomenGeleend).toLocaleString('nl-NL')} euro per maand van je inkomen is studielening. Dat is geen inkomen maar een schuld die je later terugbetaalt.`);
	if (status === 'te_laag') w.push(`Je buffer is lager dan de indicatie van ± ${adviesBuffer.toLocaleString('nl-NL')} euro. Bouw die eerst op voordat je (veel) gaat beleggen.`);
	if (dureSchuld) w.push('Je hebt consumptieve schulden (zoals creditcard, persoonlijke lening of achteraf betalen). Die rente is bijna altijd hoger dan wat beleggen gemiddeld oplevert: los die eerst af.');
	if (woonquote > 0.4) w.push(`Je woonlasten zijn ${Math.round(woonquote * 100)}% van je inkomen. Boven de ~35–40% blijft er weinig ruimte over voor sparen en tegenvallers.`);
	if (vasteLasten > 0 && inkomen > 0 && vasteLasten / inkomen > 0.6) w.push(`Je vaste lasten zijn ${Math.round((vasteLasten / inkomen) * 100)}% van je inkomen. Check of abonnementen en verzekeringen goedkoper kunnen.`);

	// ── tips
	const tips: Suggestie[] = [];
	if (status === 'te_laag')
		tips.push({
			titel: 'Eerst je buffer',
			tekst: `Zet ${maandSparen.toLocaleString('nl-NL')} euro per maand automatisch op een spaarrekening die je direct kunt opnemen.${maandenTotVol ? ` Dan is je buffer over ± ${maandenTotVol} maanden op peil.` : ''}`,
			bedrag: maandSparen,
			links: [BRONNEN.nibudBuffer]
		});
	if (dureSchuld)
		tips.push({ titel: 'Dure schulden aflossen', tekst: 'Los consumptieve schulden af voordat je belegt. Kom je er niet uit, dan helpt Geldfit gratis en anoniem.', links: [BRONNEN.schuldhulp] });
	if (maandBeleggen > 0)
		tips.push({
			titel: 'Periodiek beleggen in een breed gespreide indexfonds/ETF',
			tekst: `Indicatie: ± ${maandBeleggen.toLocaleString('nl-NL')} euro per maand, verdeeld ${verdeling.aandelen}% aandelen en ${verdeling.obligaties}% obligaties (profiel "${risico}"). Beleg alleen geld dat je de komende 5+ jaar niet nodig hebt. Onderzoek (SPIVA) laat zien dat de meeste actieve fondsen op lange termijn achterblijven bij een goedkope index.`,
			bedrag: maandBeleggen,
			links: [BRONNEN.afm, BRONNEN.spiva]
		});
	if (korteHorizon)
		tips.push({ titel: 'Korte horizon: sparen in plaats van beleggen', tekst: 'Heb je het geld binnen 5 jaar nodig (bijv. voor een huis)? Dan is sparen verstandiger: koersen kunnen in die periode flink dalen.', links: [BRONNEN.afm] });
	if (d.werkstatus === 'zelfstandig')
		tips.push({ titel: 'Zzp: reserveer belasting en pensioen', tekst: 'Zet btw en ± 25–35% van je winst apart voor inkomstenbelasting en Zvw. Je bouwt geen pensioen via een werkgever op: lijfrente of pensioenbeleggen binnen je jaarruimte is fiscaal aftrekbaar.', links: [BRONNEN.lijfrente] });
	if (d.werkstatus === 'student' || n(d.studieschuld) > 0)
		tips.push({ titel: 'Studieschuld slim aanpakken', tekst: 'Leen alleen wat je echt nodig hebt. Je betaalt draagkrachtafhankelijk terug; extra aflossen kan altijd zonder boete. Je studieschuld telt mee bij een hypotheekaanvraag.', links: [BRONNEN.duo] });
	if (financieel > HEFFINGSVRIJ_2026 * (d.samenwonend ? 2 : 1))
		tips.push({ titel: 'Let op box 3', tekst: `Je spaargeld en beleggingen liggen boven het heffingsvrij vermogen van ${(HEFFINGSVRIJ_2026 * (d.samenwonend ? 2 : 1)).toLocaleString('nl-NL')} euro (2026${d.samenwonend ? ', met fiscaal partner' : ''}). Over het meerdere betaal je vermogensrendementsheffing.`, links: [BRONNEN.box3] });
	if ((d.doel === 'pensioen' || n(leeftijd) >= 40) && d.werkstatus === 'loondienst')
		tips.push({ titel: 'Check je pensioengat', tekst: 'Kijk op mijnpensioenoverzicht.nl hoeveel pensioen je opbouwt. Heb je jaarruimte, dan is extra inleggen in een lijfrente fiscaal aantrekkelijk.', links: [{ label: 'Mijnpensioenoverzicht.nl', url: 'https://www.mijnpensioenoverzicht.nl/' }, BRONNEN.lijfrente] });

	const etfs = maandBeleggen > 0 ? (risico === 'laag' ? [ETFS[1], ETFS[4], ETFS[3]] : risico === 'gemiddeld' ? [ETFS[0], ETFS[2], ETFS[3]] : [ETFS[0], ETFS[1], ETFS[2]]) : [];

	return {
		inkomen,
		inkomenGeleend,
		vasteLasten,
		variabel,
		uitgaven,
		vrijeRuimte,
		spaarquote,
		woonquote,
		buffer: { advies: adviesBuffer, huidig, maanden: uitgaven ? huidig / uitgaven : 0, status, tekort, maandenTotVol },
		maandSparen,
		maandBeleggen,
		risico,
		verdeling,
		score,
		scoreLabel,
		vermogen: { financieel, totaal, exclWoning, woningNetto, schulden },
		waarschuwingen: w,
		tips,
		etfs,
		leeftijd
	};
}

// ───────────────────────────── projectie
export interface ProjectiePunt {
	leeftijd: number;
	waarde: number;
}

/**
 * Projecteer vermogen per jaar tot `tot` jaar.
 * Belegd deel groeit met `rendement`, spaardeel met `spaarrente`. Eigen woning blijft gelijk (conservatief).
 */
export function projecteer(opts: {
	leeftijd: number;
	start: number;
	startBelegd: number;
	maandSparen: number;
	maandBeleggen: number;
	rendement: number; // %
	spaarrente: number; // %
	inflatie?: number; // % → reëel als opgegeven
	tot?: number;
}): ProjectiePunt[] {
	const tot = opts.tot ?? 85;
	const rb = (1 + opts.rendement / 100) / (1 + (opts.inflatie ?? 0) / 100) - 1;
	const rs = (1 + opts.spaarrente / 100) / (1 + (opts.inflatie ?? 0) / 100) - 1;
	let belegd = Math.max(0, opts.startBelegd);
	let rest = opts.start - belegd;
	const out: ProjectiePunt[] = [{ leeftijd: opts.leeftijd, waarde: opts.start }];
	for (let a = opts.leeftijd + 1; a <= tot; a++) {
		const werkend = a <= 67;
		for (let m = 0; m < 12; m++) {
			belegd = belegd * (1 + rb / 12) + (werkend ? opts.maandBeleggen : 0);
			rest = rest * (1 + (rest > 0 ? rs : 0) / 12) + (werkend ? opts.maandSparen : 0);
		}
		out.push({ leeftijd: a, waarde: belegd + rest });
	}
	return out;
}
