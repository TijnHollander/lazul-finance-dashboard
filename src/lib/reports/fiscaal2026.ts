/**
 * Fiscale en financiële kengetallen 2026 — op één plek, zodat ze jaarlijks makkelijk bij te werken zijn.
 * Gecontroleerd in oktober 2026; zie de bronnen per waarde.
 */

export const JAAR = 2026;

/** Box 1 (onder AOW-leeftijd) */
export const BOX1 = [
	{ tot: 38_883, tarief: 0.3575 },
	{ tot: 78_426, tarief: 0.3756 },
	{ tot: Infinity, tarief: 0.495 }
];
/** Maximaal aftrektarief voor o.a. hypotheekrente en lijfrente-/giftenaftrek (2026) */
export const MAX_AFTREKTARIEF = 0.3756;
export const EIGENWONINGFORFAIT = 0.0035;

/** Box 3 */
export const BOX3 = {
	heffingsvrij: 59_357,
	tarief: 0.36,
	rendSparen: 0.0128,
	rendBeleggen: 0.06,
	rendSchulden: 0.027,
	schuldendrempel: 3_800,
	groenVrijstelling: 26_715
};

/** Pensioen */
export const JAARRUIMTE_MAX = 35_589;
export const RESERVERINGSRUIMTE_MAX = 42_753;
/** Netto AOW per maand per 1 juli 2026, incl. loonheffingskorting */
export const AOW_NETTO = { alleen: 1_581, samen: 1_084 };
export const AOW_LEEFTIJD = 67;

/** Wonen */
export const NHG_GRENS = 470_000;
export const NHG_GRENS_ENERGIE = 498_200;
export const NHG_PROVISIE = 0.004;
export const STARTERSVRIJSTELLING_GRENS = 555_000;
export const STARTERS_MAX_LEEFTIJD = 34; // tot 35 jaar
export const OVERDRACHTSBELASTING_EIGEN = 0.02;

/**
 * Woonquote (financieringslastpercentage) per toetsinkomen bij toetsrente 3,5 / 4,0 / 4,5%.
 * Indicatief, gekalibreerd op voorbeeldberekeningen 2026 (± € 245k bij € 50k, ± € 300k bij € 65k, ± € 397k bij € 80k).
 * Officiële tabellen: Nibud-advies hypotheeknormen 2026 / Tijdelijke regeling hypothecair krediet.
 */
export const WOONQUOTE: { inkomen: number; q35: number; q40: number; q45: number }[] = [
	{ inkomen: 30_000, q35: 0.205, q40: 0.21, q45: 0.215 },
	{ inkomen: 40_000, q35: 0.245, q40: 0.25, q45: 0.255 },
	{ inkomen: 50_000, q35: 0.26, q40: 0.265, q45: 0.27 },
	{ inkomen: 60_000, q35: 0.26, q40: 0.265, q45: 0.27 },
	{ inkomen: 70_000, q35: 0.262, q40: 0.267, q45: 0.272 },
	{ inkomen: 80_000, q35: 0.272, q40: 0.277, q45: 0.282 },
	{ inkomen: 100_000, q35: 0.285, q40: 0.29, q45: 0.295 }
];

/** Ondernemers */
export const ZELFSTANDIGENAFTREK = 1_200;
export const STARTERSAFTREK = 2_123;
export const MKB_WINSTVRIJSTELLING = 0.127;
export const URENCRITERIUM = 1_225;

/** Schenken */
export const SCHENKING = { kind: 6_908, kindEenmalig: 33_129, derden: 2_769 };

/** Nibud-richtbedragen (indicatief) voor huishoudelijke uitgaven per maand */
export const NIBUD_VOEDING = { basis1: 290, basis2: 500, perKind: 130 };

export const BRONNEN_2026 = {
	box1: { label: 'Belastingdienst – Box 1: uitleg en tarieven', url: 'https://www.belastingdienst.nl/wps/wcm/connect/bldcontentnl/belastingdienst/prive/inkomstenbelasting/heffingskortingen_boxen_tarieven/boxen_en_tarieven/box_1/box_1' },
	box3: { label: 'Belastingdienst – Box 3', url: 'https://www.belastingdienst.nl/wps/wcm/connect/nl/box-3/box-3' },
	lijfrente: { label: 'Belastingdienst – Aftrekken lijfrentepremies', url: 'https://www.belastingdienst.nl/wps/wcm/connect/bldcontentnl/belastingdienst/prive/werk_en_inkomen/lijfrente/aftrekken-lijfrentepremies/aftrekken-lijfrentepremies' },
	nhg: { label: 'NHG – Nationale Hypotheek Garantie', url: 'https://www.nhg.nl/' },
	overdracht: { label: 'Belastingdienst – Startersvrijstelling', url: 'https://www.belastingdienst.nl/wps/wcm/connect/bldcontentnl/belastingdienst/prive/woning/overdrachtsbelasting/startersvrijstelling/startersvrijstelling' },
	nibudHypotheek: { label: 'Nibud – Advies hypotheeknormen 2026', url: 'https://www.nibud.nl/onderzoeksrapporten/rapport-advies-hypotheeknormen-2026-2025/' },
	afmHypotheek: { label: 'AFM – Kun je de hypotheek betalen?', url: 'https://www.afm.nl/nl-nl/consumenten/themas/hypotheken/hypotheek-betalen' },
	svb: { label: 'SVB – Je AOW-leeftijd', url: 'https://www.svb.nl/nl/aow/aow-leeftijd/uw-aow-leeftijd' },
	mpo: { label: 'Mijnpensioenoverzicht.nl', url: 'https://www.mijnpensioenoverzicht.nl/' },
	toeslagen: { label: 'Dienst Toeslagen – proefberekening 2026', url: 'https://www.belastingdienst.nl/wps/wcm/connect/nl/toeslagen-2026/topics/hoeveel-toeslag-in-2026' },
	geldfit: { label: 'Geldfit – gratis hulp bij schulden', url: 'https://www.geldfit.nl/' },
	duo: { label: 'DUO – Studieschuld terugbetalen', url: 'https://duo.nl/particulier/studieschuld-terugbetalen/' },
	anbi: { label: 'Belastingdienst – Zijn giften aftrekbaar?', url: 'https://www.belastingdienst.nl/wps/wcm/connect/nl/aftrek-en-kortingen/content/gift-aftrekken' },
	schenken: { label: 'Belastingdienst – Belastingvrij schenken 2026', url: 'https://www.belastingdienst.nl/wps/wcm/connect/nl/schenken/content/tot-welk-bedrag-belastingvrij-schenken' },
	zzp: { label: 'Belastingdienst – Ondernemersaftrek', url: 'https://www.belastingdienst.nl/wps/wcm/connect/bldcontentnl/belastingdienst/zakelijk/winst/inkomstenbelasting/inkomstenbelasting_voor_ondernemers/ondernemersaftrek/ondernemersaftrek' },
	wozloket: { label: 'WOZ-waardeloket', url: 'https://www.wozwaardeloket.nl/' },
	nibud: { label: 'Nibud – Huishoudelijke uitgaven', url: 'https://www.nibud.nl/onderwerpen/uitgaven/huishoudelijke-uitgaven/' }
};

/** Marginaal box 1-tarief bij een bruto jaarinkomen */
export function marginaalTarief(inkomen: number): number {
	return (BOX1.find((s) => inkomen <= s.tot) ?? BOX1[BOX1.length - 1]).tarief;
}

/** Aftrektarief: marginaal tarief, maar maximaal het beperkte aftrektarief */
export function aftrekTarief(inkomen: number): number {
	return Math.min(marginaalTarief(inkomen), MAX_AFTREKTARIEF);
}

/** Annuïteit: maandlast bij lening, jaarrente (fractie), looptijd jaren */
export function annuiteit(lening: number, rente: number, jaren: number): number {
	const r = rente / 12;
	const n = jaren * 12;
	if (r === 0) return lening / n;
	return (lening * r) / (1 - Math.pow(1 + r, -n));
}

/** Contante waarde van een annuïteit: welke lening hoort bij een maandlast */
export function leningBijMaandlast(maandlast: number, rente: number, jaren: number): number {
	const r = rente / 12;
	const n = jaren * 12;
	if (r === 0) return maandlast * n;
	return (maandlast * (1 - Math.pow(1 + r, -n))) / r;
}
