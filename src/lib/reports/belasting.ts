import { BOX3, JAARRUIMTE_MAX, MAX_AFTREKTARIEF, ZELFSTANDIGENAFTREK, STARTERSAFTREK, MKB_WINSTVRIJSTELLING, URENCRITERIUM, SCHENKING, EIGENWONINGFORFAIT, BRONNEN_2026 as B, marginaalTarief, aftrekTarief } from './fiscaal2026';
import type { Tip } from './types';

/**
 * Belastingvoordelen-check (doorontwikkeld uit het Lazul-belastingrapport, bedragen 2026).
 * Geeft per regeling een geschat voordeel in euro's per jaar.
 */

export interface BelastingData {
	werkstatus: 'loondienst' | 'zzp' | 'student' | 'pensioen' | 'anders';
	brutoInkomen: number | null; // per jaar (bij zzp: winst)
	partner: boolean;
	kinderen: number;
	kind18plus: boolean;
	woonsituatie: 'huur' | 'koop' | 'bij_ouders';
	hypotheekRenteJaar: number | null;
	woz: number | null;
	eigenwoningschuld: number | null;
	energielabel: 'A+' | 'A' | 'B' | 'C' | 'D' | 'EFG' | null;
	pensioenWerkgever: boolean;
	lijfrenteInleg: number | null; // per jaar
	spaargeld: number | null;
	beleggingen: number | null;
	groeneBeleggingen: number | null;
	schuldenBox3: number | null; // bijv. studieschuld, consumptief
	studieschuld: number | null;
	giftenJaar: number | null;
	periodiekeGift: boolean;
	wilSchenkenAanKind: boolean;
	zzpUren: number | null;
	zzpStarter: boolean;
	ontvangtToeslagen: boolean;
}

export const emptyBelasting = (): BelastingData => ({
	werkstatus: 'loondienst',
	brutoInkomen: null,
	partner: false,
	kinderen: 0,
	kind18plus: false,
	woonsituatie: 'huur',
	hypotheekRenteJaar: null,
	woz: null,
	eigenwoningschuld: null,
	energielabel: null,
	pensioenWerkgever: true,
	lijfrenteInleg: null,
	spaargeld: null,
	beleggingen: null,
	groeneBeleggingen: null,
	schuldenBox3: null,
	studieschuld: null,
	giftenJaar: null,
	periodiekeGift: false,
	wilSchenkenAanKind: false,
	zzpUren: null,
	zzpStarter: false,
	ontvangtToeslagen: false
});

export interface Box3Resultaat {
	grondslag: number;
	belasting: number;
	vrijstelling: number;
	forfaitRendement: number;
}

export function box3(d: BelastingData): Box3Resultaat {
	const n = (v: number | null) => v ?? 0;
	const personen = d.partner ? 2 : 1;
	const groen = Math.min(n(d.groeneBeleggingen), BOX3.groenVrijstelling * personen);
	const sparen = n(d.spaargeld);
	const beleg = n(d.beleggingen) + n(d.groeneBeleggingen) - groen;
	const schuld = Math.max(0, n(d.schuldenBox3) - BOX3.schuldendrempel * personen);
	const rendement = sparen * BOX3.rendSparen + beleg * BOX3.rendBeleggen - schuld * BOX3.rendSchulden;
	const totaal = sparen + beleg - schuld;
	const vrijstelling = BOX3.heffingsvrij * personen;
	const grondslag = Math.max(0, totaal - vrijstelling);
	const effectief = totaal > 0 ? Math.max(0, rendement) / totaal : 0;
	return { grondslag, belasting: Math.round(grondslag * effectief * BOX3.tarief), vrijstelling, forfaitRendement: effectief };
}

export interface BelastingResultaat {
	tips: Tip[];
	totaalVoordeel: number;
	marginaal: number;
	box3: Box3Resultaat;
}

export function berekenBelasting(d: BelastingData): BelastingResultaat {
	const n = (v: number | null) => v ?? 0;
	const eur = (v: number) => `€ ${Math.round(v).toLocaleString('nl-NL')}`;
	const ink = n(d.brutoInkomen);
	const marginaal = marginaalTarief(ink);
	const aftrek = aftrekTarief(ink);
	const tips: (Tip & { bedrag?: number })[] = [];
	const b3 = box3(d);

	// ── pensioen / lijfrente
	if (d.werkstatus !== 'pensioen' && d.werkstatus !== 'student' && ink > 20_000) {
		const ruimteSchatting = d.pensioenWerkgever ? Math.min(JAARRUIMTE_MAX, Math.max(0, (ink - 19_000) * 0.3 - (ink - 19_000) * 0.2)) : Math.min(JAARRUIMTE_MAX, Math.max(0, (ink - 19_000) * 0.3));
		const benut = n(d.lijfrenteInleg);
		const over = Math.max(0, ruimteSchatting - benut);
		if (over > 500) {
			const voordeel = over * aftrek;
			tips.push({
				prioriteit: d.pensioenWerkgever ? 'gemiddeld' : 'hoog',
				titel: `Onbenutte jaarruimte: ± ${eur(over)} aftrekbaar`,
				tekst: `${d.pensioenWerkgever ? 'Ook met een werkgeverspensioen houd je vaak jaarruimte over (bijv. door een pensioengat of parttime werk).' : 'Zonder werkgeverspensioen is je jaarruimte groot.'} Inleg in een lijfrente- of bankspaarrekening is aftrekbaar tegen ${Math.round(aftrek * 1000) / 10}%. Je jaarruimte staat precies op je UPO; dit is een schatting.`,
				voordeel: `± ${eur(voordeel)} per jaar belastingvoordeel`,
				bedrag: voordeel,
				links: [B.lijfrente, B.mpo]
			});
		}
	}

	// ── eigen woning
	if (d.woonsituatie === 'koop') {
		const forfait = n(d.woz) * EIGENWONINGFORFAIT;
		const rente = n(d.hypotheekRenteJaar);
		if (rente > 0) {
			const voordeel = Math.max(0, rente - forfait) * MAX_AFTREKTARIEF;
			tips.push({
				prioriteit: 'gemiddeld',
				titel: 'Hypotheekrenteaftrek: vraag een voorlopige teruggaaf aan',
				tekst: `Je hypotheekrente (${eur(rente)}) minus het eigenwoningforfait (${eur(forfait)}) is aftrekbaar tegen maximaal 37,56%. Met een voorlopige teruggaaf krijg je dat geld elke maand in plaats van één keer per jaar.`,
				voordeel: `± ${eur(voordeel)} per jaar (± ${eur(voordeel / 12)} per maand)`,
				bedrag: 0,
				links: [B.box1]
			});
		}
		const ltv = n(d.woz) > 0 ? n(d.eigenwoningschuld) / n(d.woz) : 1;
		if (n(d.woz) > 0 && n(d.eigenwoningschuld) > 0 && ltv < 0.8) {
			const voordeel = n(d.eigenwoningschuld) * (ltv < 0.6 ? 0.003 : 0.0015);
			tips.push({
				prioriteit: 'hoog',
				titel: `Lage schuld t.o.v. woningwaarde (${Math.round(ltv * 100)}%): vraag renteverlaging`,
				tekst: 'Banken rekenen minder rente naarmate je schuld lager is ten opzichte van de woningwaarde. Dat wordt niet altijd automatisch aangepast: vraag een herbeoordeling met een recente taxatie of WOZ-waarde.',
				voordeel: `± ${eur(voordeel)} per jaar minder rente`,
				bedrag: voordeel * (1 - MAX_AFTREKTARIEF),
				links: [B.wozloket]
			});
		}
		if (d.energielabel && ['C', 'D', 'EFG'].includes(d.energielabel))
			tips.push({ prioriteit: 'gemiddeld', titel: `Energielabel ${d.energielabel === 'EFG' ? 'E/F/G' : d.energielabel}: verduurzamen loont dubbel`, tekst: 'Isolatie, een warmtepomp of zonnepanelen verlagen je energierekening, verhogen de woningwaarde en geven extra leenruimte. Check de ISDE-subsidie en vraag naar een groene hypotheekkorting.', links: [{ label: 'Verbeterjehuis.nl – subsidies verduurzamen', url: 'https://www.verbeterjehuis.nl/' }] });
		tips.push({ prioriteit: 'laag', titel: 'Check je WOZ-beschikking', tekst: 'Een te hoge WOZ-waarde betekent een hoger eigenwoningforfait, meer OZB en waterschapsbelasting. Bezwaar maken is gratis, binnen 6 weken na de beschikking.', links: [B.wozloket] });
	}

	// ── box 3
	if (b3.belasting > 0) {
		const sparenDeel = n(d.spaargeld) / Math.max(1, n(d.spaargeld) + n(d.beleggingen));
		tips.push({
			prioriteit: 'gemiddeld',
			titel: `Je betaalt ± ${eur(b3.belasting)} box 3-belasting`,
			tekst: `Je vermogen ligt ${eur(b3.grondslag)} boven het heffingsvrij vermogen (${eur(b3.vrijstelling)}). ${sparenDeel > 0.5 ? 'Op spaargeld rekent de fiscus 1,28% rendement; op beleggingen 6%. ' : ''}Opties: aflossen op (niet-aftrekbare) schulden, schenken aan kinderen, of groene beleggingen (tot € 26.715 p.p. vrijgesteld). Heb je in werkelijkheid minder rendement gehaald, dan kun je dat met tegenbewijs aantonen.`,
			voordeel: 'afhankelijk van de keuze',
			links: [B.box3]
		});
	} else if (n(d.spaargeld) + n(d.beleggingen) > 0)
		tips.push({ prioriteit: 'laag', titel: 'Je zit onder het heffingsvrij vermogen', tekst: `Tot ${eur(b3.vrijstelling)} betaal je geen box 3-belasting. Je hoeft hier dus niets mee te doen.`, links: [B.box3] });

	if (n(d.groeneBeleggingen) === 0 && b3.belasting > 200) {
		const voordeel = Math.min(BOX3.groenVrijstelling, b3.grondslag) * BOX3.rendBeleggen * BOX3.tarief;
		tips.push({ prioriteit: 'laag', titel: 'Groene beleggingen: extra vrijstelling', tekst: 'Erkende groene fondsen zijn tot € 26.715 per persoon vrijgesteld in box 3 en geven 0,1% heffingskorting. Let wel op rendement en kosten: belastingvoordeel alleen is geen reden.', voordeel: `tot ± ${eur(voordeel)} per jaar`, bedrag: voordeel * 0.5, links: [B.box3] });
	}

	// ── giften
	if (n(d.giftenJaar) > 0 && !d.periodiekeGift) {
		const drempel = Math.max(60, ink * 0.01);
		const nuAftrekbaar = Math.max(0, n(d.giftenJaar) - drempel);
		const voordeel = (n(d.giftenJaar) - nuAftrekbaar) * aftrek;
		tips.push({ prioriteit: 'gemiddeld', titel: 'Maak van je gift een periodieke gift', tekst: `Gewone giften zijn pas aftrekbaar boven een drempel van 1% van je inkomen (± ${eur(drempel)}). Leg je een gift aan een ANBI 5 jaar vast in een overeenkomst, dan is alles aftrekbaar zonder drempel.`, voordeel: `± ${eur(voordeel)} per jaar extra aftrek`, bedrag: voordeel, links: [B.anbi] });
	}

	// ── schenken
	if (d.wilSchenkenAanKind && d.kinderen > 0)
		tips.push({ prioriteit: 'laag', titel: `Schenken aan je kinderen: ${eur(SCHENKING.kind)} per kind per jaar belastingvrij`, tekst: `Eenmalig mag een kind van 18 t/m 39 jaar ${eur(SCHENKING.kindEenmalig)} belastingvrij ontvangen. Schenken verlaagt ook jouw box 3-vermogen.`, links: [B.schenken] });

	// ── kinderen
	if (d.kind18plus)
		tips.push({ prioriteit: 'gemiddeld', titel: 'Kind van 18+: kinderbijslag en kindgebonden budget stoppen', tekst: 'Vanaf 18 jaar stopt de kinderbijslag; het kindgebonden budget stopt ook. Een thuiswonend kind met eigen inkomen kan meetellen voor huur- en zorgtoeslag. Geef wijzigingen door om terugbetalen te voorkomen.', links: [B.toeslagen] });
	if (d.ontvangtToeslagen || (ink > 0 && ink < 45_000))
		tips.push({ prioriteit: d.ontvangtToeslagen ? 'gemiddeld' : 'laag', titel: d.ontvangtToeslagen ? 'Houd je toeslagen actueel' : 'Mogelijk recht op zorg- of huurtoeslag', tekst: d.ontvangtToeslagen ? 'Verandert je inkomen (loonsverhoging, bonus, partner)? Pas je toeslagen direct aan, anders volgt een terugvordering.' : 'Met dit inkomen kun je mogelijk zorgtoeslag of huurtoeslag krijgen. Doe de gratis proefberekening.', links: [B.toeslagen] });

	// ── studieschuld
	if (n(d.studieschuld) > 0)
		tips.push({ prioriteit: 'laag', titel: 'Studieschuld telt als schuld in box 3', tekst: 'Je DUO-schuld verlaagt je box 3-vermogen (boven de schuldendrempel van € 3.800). Extra aflossen is boetevrij, maar met een lage DUO-rente is het vaak gunstiger om eerst je buffer en beleggingen op te bouwen.', links: [B.duo] });

	// ── zzp
	if (d.werkstatus === 'zzp') {
		if (n(d.zzpUren) >= URENCRITERIUM) {
			const za = (ZELFSTANDIGENAFTREK + (d.zzpStarter ? STARTERSAFTREK : 0)) * marginaal;
			tips.push({ prioriteit: 'hoog', titel: `Zelfstandigenaftrek${d.zzpStarter ? ' + startersaftrek' : ''}`, tekst: `Je haalt het urencriterium (${URENCRITERIUM} uur). In 2026 is de zelfstandigenaftrek ${eur(ZELFSTANDIGENAFTREK)}${d.zzpStarter ? ` en de startersaftrek ${eur(STARTERSAFTREK)}` : ''}. Houd je urenadministratie goed bij.`, voordeel: `± ${eur(za)} per jaar`, bedrag: za, links: [B.zzp] });
		} else
			tips.push({ prioriteit: 'gemiddeld', titel: 'Urencriterium niet gehaald?', tekst: `Onder ${URENCRITERIUM} uur per jaar geen zelfstandigenaftrek. Tel ook acquisitie, administratie en scholing mee; die uren tellen.`, links: [B.zzp] });
		const mkb = ink * (1 - 0) * MKB_WINSTVRIJSTELLING * marginaal;
		tips.push({ prioriteit: 'gemiddeld', titel: 'MKB-winstvrijstelling: 12,7% van je winst vrij', tekst: 'Deze vrijstelling krijg je automatisch, ook zonder urencriterium. Reserveer intussen wel maandelijks voor de aanslag (en de Zvw-bijdrage).', voordeel: `± ${eur(mkb)} per jaar`, bedrag: 0, links: [B.zzp] });
	}

	tips.push({ prioriteit: 'laag', titel: 'Vraag een voorlopige aanslag of teruggaaf aan', tekst: 'Heb je aftrekposten (hypotheek, lijfrente, giften)? Met een voorlopige teruggaaf krijg je het voordeel maandelijks. Als zzp’er voorkom je met een voorlopige aanslag een grote rekening achteraf.', links: [B.box1] });

	const order = { hoog: 0, gemiddeld: 1, laag: 2 };
	tips.sort((a, b) => order[a.prioriteit] - order[b.prioriteit]);
	const totaalVoordeel = tips.reduce((a, t) => a + (t.bedrag ?? 0), 0);
	return { tips, totaalVoordeel, marginaal, box3: b3 };
}
