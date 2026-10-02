import type { BankTx } from './parsers/bank';

export const CATEGORIES = [
	'Salaris & werk',
	'Uitkering & toeslagen',
	'Studiefinanciering',
	'Overige inkomsten',
	'Wonen',
	'Energie & water',
	'Verzekeringen',
	'Telecom & abonnementen',
	'Boodschappen',
	'Vervoer',
	'Uit eten & horeca',
	'Winkelen',
	'Gezondheid & verzorging',
	'Vrije tijd & reizen',
	'Belastingen & overheid',
	'Kinderen & onderwijs',
	'Contant geld',
	'Sparen & beleggen',
	'Interne overboeking',
	'Overig'
] as const;
export type Category = (typeof CATEGORIES)[number];

/** Categorieën die als vaste lasten tellen */
export const FIXED: Category[] = ['Wonen', 'Energie & water', 'Verzekeringen', 'Telecom & abonnementen', 'Belastingen & overheid', 'Kinderen & onderwijs'];
/** Categorieën die geen inkomsten of uitgaven zijn (geld blijft van jou) */
export const NEUTRAL: Category[] = ['Sparen & beleggen', 'Interne overboeking'];

export const CATEGORY_COLORS: Record<Category, string> = {
	'Salaris & werk': '#34d399',
	'Uitkering & toeslagen': '#6ee7b7',
	Studiefinanciering: '#a7f3d0',
	'Overige inkomsten': '#10b981',
	Wonen: '#c27aff',
	'Energie & water': '#ad46ff',
	Verzekeringen: '#8b5cf6',
	'Telecom & abonnementen': '#dd1aca',
	Boodschappen: '#f472b6',
	Vervoer: '#60a5fa',
	'Uit eten & horeca': '#fb923c',
	Winkelen: '#facc15',
	'Gezondheid & verzorging': '#2dd4bf',
	'Vrije tijd & reizen': '#38bdf8',
	'Belastingen & overheid': '#e879f9',
	'Kinderen & onderwijs': '#a78bfa',
	'Contant geld': '#94a3b8',
	'Sparen & beleggen': '#4ade80',
	'Interne overboeking': '#64748b',
	Overig: '#71717a'
};

const RULES: [Category, RegExp, 'in' | 'out' | 'any'][] = [
	['Sparen & beleggen', /spaarrekening|oranje spaar|spaardeposito|sparen|savings|degiro|flatex|trading ?212|trade ?republic|meesman|brand new day|bux|saxo|peaks|centraal beheer achmea beleggen|ing beleggen|abn amro beleggen|rabo beleggen|lynx|mintos|bitvavo|coinbase|kraken|vanguard|northern trust|binck|ohpen/i, 'any'],
	['Salaris & werk', /salaris|salary|loon|payroll|netto ?loon|vakantiegeld|bonus|declaratie|uitzendbureau|randstad|tempo.?team|youngcapital|olympia/i, 'in'],
	['Uitkering & toeslagen', /uwv|svb|toeslag|kinderbijslag|kindgebonden|zorgtoeslag|huurtoeslag|aow|gemeente.*(uitkering|bijstand)|participatiewet/i, 'in'],
	['Studiefinanciering', /\bduo\b|dienst uitvoering onderwijs|studiefinanciering/i, 'in'],
	['Overige inkomsten', /teruggaaf|teruggave|voorlopige aanslag.*terug/i, 'in'],
	['Uitkering & toeslagen', /belastingdienst/i, 'in'],
	['Wonen', /\bhuur\b|huurpenningen|hypotheek|woningcorporatie|woonstichting|wooncorporatie|vve |vereniging van eigenaren|ymere|eigen haard|vestia|portaal|woonbron|havensteder|de alliantie|stadgenoot|mitros|woonstad|woonzorg|bouwinvest|vesteda|rochdale|hypotheekrente|obvion|florius|munt hypotheken|bijbouwe/i, 'out'],
	['Energie & water', /vattenfall|eneco|essent|greenchoice|budget ?energie|vandebron|energiedirect|oxxio|engie|pure energie|frank energie|tibber|zonneplan|easyenergy|waternet|vitens|evides|brabant water|\bpwn\b|dunea|oasen|wml|wbg|waterbedrijf|stadsverwarming|warmte/i, 'out'],
	['Verzekeringen', /zilveren kruis|\bcz\b|\bvgz\b|menzis|ohra|centraal beheer|interpolis|fbto|nationale.?nederlanden|univ[eé]|anwb verzeker|a\.?s\.?r|ditzo|inshared|allianz|zorgverzeker|verzekering|aegon|dsw|zekur|ik kies zeker|ditzo|\bonvz\b|de friesland|ditzo|klaverblad|ansvar|ditzo|independer/i, 'out'],
	['Telecom & abonnementen', /\bkpn\b|vodafone|odido|t-mobile|ziggo|tele2|simyo|\bben\b|lebara|youfone|hollandsnieuwe|delta fiber|caiway|netflix|spotify|disney|videoland|\bhbo\b|max\.com|apple\.com|itunes|google|youtube|amazon prime|prime video|icloud|chatgpt|openai|adobe|microsoft|dropbox|patreon|nrc|volkskrant|telegraaf|\bad\.nl|parool|npo plus|basic-fit|sportcity|fit for free|anytime fitness|trainmore|sportschool|abonnement|claude\.ai|anthropic/i, 'out'],
	['Boodschappen', /albert heijn|\bah\b|ah to go|jumbo|\blidl\b|\baldi\b|\bplus\b|dirk|\bcoop\b|\bspar\b|picnic|ekoplaza|vomar|hoogvliet|\bdeen\b|poiesz|nettorama|boni|jan linders|dekamarkt|crisp|flink|getir|gorillas|marqt|odin|slagerij|bakkerij|bakker|toko|amazing oriental/i, 'out'],
	['Vervoer', /\bns\b|ns-|ns groep|\bgvb\b|\bret\b|\bhtm\b|arriva|connexxion|qbuzz|keolis|ebs|ov-chip|ovpay|translink|shell|\bbp\b|esso|tango|tinq|totalenergies|texaco|gulf|argos|tamoil|q-park|parkeren|parkmobile|yellowbrick|easypark|anwb|swapfiets|\buber\b(?! eats)|\bbolt\b|felyx|check |greenwheels|mywheels|tesla|fastned|allego|vandebron laad|shell recharge|wegenbelasting|apk|garage|autobedrijf|kwik-fit|euromaster|lease/i, 'out'],
	['Uit eten & horeca', /thuisbezorgd|uber ?eats|deliveroo|mcdonald|burger king|\bkfc\b|starbucks|restaurant|\bcafe\b|caf[eé]|\bbar\b|domino|new york pizza|febo|subway|wagamama|five guys|smullers|la place|bagels|\bbistro|eetcafe|brasserie|pizzeria|sushi|kebab|snackbar|lunchroom|horeca|bierfabriek|vapiano|happy italy|loetje|\bbakery\b/i, 'out'],
	['Winkelen', /bol\.com|\bbol\b|coolblue|zalando|amazon|h&m|\bh & m\b|primark|\baction\b|hema|ikea|mediamarkt|\bblokker|decathlon|wehkamp|aliexpress|temu|shein|zeeman|c&a|we fashion|only|jack ?& ?jones|nike|adidas|intertoys|gamma|praxis|karwei|hornbach|kwantum|leen bakker|xenos|flying tiger|rituals|douglas|ici paris|apple store|bcc|alternate|megekko|vinted|marktplaats|thomann|bijenkorf|de bijenkorf|zara|mango|uniqlo|scotch|suitsupply|ochama|lucardi/i, 'out'],
	['Gezondheid & verzorging', /apotheek|tandarts|huisarts|fysio|ziekenhuis|kruidvat|etos|trekpleister|da drogist|holland & barrett|opticien|specsavers|pearle|hans anders|kapper|barber|dermatoloog|psycholoog|eigen risico/i, 'out'],
	['Vrije tijd & reizen', /booking\.com|airbnb|klm|transavia|ryanair|easyjet|vueling|tui|sunweb|corendon|hotel|hostel|camping|pathe|path[eé]|vue|kinepolis|ticketmaster|eventim|ticketswap|museum|efteling|steam|playstation|xbox|nintendo|epic games|bioscoop|concert|festival|vakantie|center ?parcs|landal|roompot|ns international|flixbus|eurostar|uber trip|gall ?& ?gall|slijterij|mitra/i, 'out'],
	['Belastingen & overheid', /belastingdienst|gemeente|waterschap|\bcjib\b|\brdw\b|gemeentelijke belasting|bghu|\bsvhw\b|gbt|\bbsgw\b|rbg|cocensus|\bbghu\b|hhnk|rijnland|leges|griffierechten/i, 'out'],
	['Kinderen & onderwijs', /kinderopvang|kinderdagverblijf|bso|gastouder|school|universiteit|hogeschool|collegegeld|studielink|\bduo\b|oudergroep|partou|kinderrijk|smallsteps|kids first/i, 'out'],
	['Contant geld', /geldautomaat|geldmaat|\batm\b|opname|cash withdrawal/i, 'out'],
	['Overige inkomsten', /tikkie|betaalverzoek|terugbetaling|refund|restitutie|retour|cashback|rente|interest|marktplaats|vinted/i, 'in']
];

export type CategoryRules = Record<string, Category>;

export function categorize(tx: BankTx, ownAccounts: Set<string>, userRules: CategoryRules): Category {
	const key = ruleKey(tx);
	if (userRules[key]) return userRules[key];
	if (tx.counterAccount && ownAccounts.has(tx.counterAccount)) return 'Interne overboeking';
	const hay = `${tx.counterparty} ${tx.description}`;
	if (/eigen rekening|naar oranje|van oranje|spaarrekening/i.test(hay) && /spaar|eigen/i.test(hay)) return 'Sparen & beleggen';
	const dir = tx.amount >= 0 ? 'in' : 'out';
	for (const [cat, re, d] of RULES) {
		if (d !== 'any' && d !== dir) continue;
		if (re.test(hay)) return cat;
	}
	return dir === 'in' ? 'Overige inkomsten' : 'Overig';
}

/** Sleutel voor een eigen regel: per tegenpartij (genormaliseerd) */
export function ruleKey(tx: BankTx): string {
	return (tx.counterAccount || tx.counterparty).toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 60);
}

export interface MonthStat {
	key: string; // YYYY-MM
	income: number;
	expenses: number; // positief getal
	fixed: number;
	variable: number;
	saved: number; // naar spaar/beleggen (netto)
	net: number;
	partial: boolean;
	byCategory: Record<string, number>;
}

export interface CashflowSummary {
	months: MonthStat[];
	used: MonthStat[]; // volledige maanden voor gemiddelden
	avgIncome: number;
	avgExpenses: number;
	wAvgIncome: number;
	wAvgExpenses: number;
	medIncome: number;
	medExpenses: number;
	avgFixed: number;
	avgVariable: number;
	avgSaved: number;
	savingsRate: number; // (inkomen - uitgaven) / inkomen
	categoryAvg: { category: Category; avg: number; share: number }[];
	incomeAvg: { category: Category; avg: number }[];
	firstDate: string | null;
	lastDate: string | null;
}

function median(xs: number[]): number {
	if (!xs.length) return 0;
	const s = [...xs].sort((a, b) => a - b);
	const m = Math.floor(s.length / 2);
	return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * Gewogen gemiddelde: recente maanden tellen zwaarder (lineaire gewichten 1..n).
 * Zo weegt een recente loonsverhoging of huurstijging sterker mee dan een maand van een jaar geleden.
 */
export function weightedAvg(xs: number[]): number {
	if (!xs.length) return 0;
	let num = 0;
	let den = 0;
	xs.forEach((x, i) => {
		const w = i + 1;
		num += x * w;
		den += w;
	});
	return num / den;
}

export function summarize(tx: BankTx[], cats: Map<string, Category>, includePartial = false): CashflowSummary {
	const byMonth = new Map<string, MonthStat>();
	let firstDate: string | null = null;
	let lastDate: string | null = null;
	for (const t of tx) {
		if (!firstDate || t.date < firstDate) firstDate = t.date;
		if (!lastDate || t.date > lastDate) lastDate = t.date;
		const key = t.date.slice(0, 7);
		let m = byMonth.get(key);
		if (!m) {
			m = { key, income: 0, expenses: 0, fixed: 0, variable: 0, saved: 0, net: 0, partial: false, byCategory: {} };
			byMonth.set(key, m);
		}
		const cat = cats.get(t.id) ?? 'Overig';
		if (cat === 'Interne overboeking') continue;
		if (cat === 'Sparen & beleggen') {
			m.saved += -t.amount;
			continue;
		}
		if (t.amount >= 0 && !isExpenseCategory(cat)) {
			m.income += t.amount;
		} else {
			// terugbetalingen in een uitgavencategorie verlagen de uitgaven
			const v = -t.amount;
			m.expenses += v;
			if (FIXED.includes(cat)) m.fixed += v;
			else m.variable += v;
		}
		m.byCategory[cat] = (m.byCategory[cat] ?? 0) + t.amount;
	}
	const months = [...byMonth.values()].sort((a, b) => a.key.localeCompare(b.key));
	for (const m of months) {
		m.net = m.income - m.expenses;
		// eerste/laatste maand gedeeltelijk als de data niet de hele maand dekt
		if (firstDate && m.key === firstDate.slice(0, 7) && Number(firstDate.slice(8)) > 5) m.partial = true;
		if (lastDate && m.key === lastDate.slice(0, 7)) {
			const [y, mo] = m.key.split('-').map(Number);
			const daysIn = new Date(y, mo, 0).getDate();
			if (Number(lastDate.slice(8)) < daysIn - 3) m.partial = true;
		}
	}
	let used = includePartial ? months : months.filter((m) => !m.partial);
	if (!used.length) used = months;
	const inc = used.map((m) => m.income);
	const exp = used.map((m) => m.expenses);
	const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
	const avgIncome = avg(inc);
	const avgExpenses = avg(exp);

	const catTotals = new Map<Category, number>();
	const incTotals = new Map<Category, number>();
	for (const m of used) {
		for (const [c, v] of Object.entries(m.byCategory) as [Category, number][]) {
			if (isExpenseCategory(c) || v < 0) catTotals.set(c, (catTotals.get(c) ?? 0) - v);
			else incTotals.set(c, (incTotals.get(c) ?? 0) + v);
		}
	}
	const n = used.length || 1;
	const totalExp = [...catTotals.values()].reduce((a, b) => a + Math.max(0, b), 0) || 1;
	const categoryAvg = [...catTotals.entries()]
		.filter(([, v]) => v > 0)
		.map(([category, v]) => ({ category, avg: v / n, share: v / totalExp }))
		.sort((a, b) => b.avg - a.avg);
	const incomeAvg = [...incTotals.entries()].map(([category, v]) => ({ category, avg: v / n })).sort((a, b) => b.avg - a.avg);

	return {
		months,
		used,
		avgIncome,
		avgExpenses,
		wAvgIncome: weightedAvg(inc),
		wAvgExpenses: weightedAvg(exp),
		medIncome: median(inc),
		medExpenses: median(exp),
		avgFixed: avg(used.map((m) => m.fixed)),
		avgVariable: avg(used.map((m) => m.variable)),
		avgSaved: avg(used.map((m) => m.saved)),
		savingsRate: avgIncome > 0 ? (avgIncome - avgExpenses) / avgIncome : 0,
		categoryAvg,
		incomeAvg,
		firstDate,
		lastDate
	};
}

function isExpenseCategory(c: Category) {
	return !['Salaris & werk', 'Uitkering & toeslagen', 'Studiefinanciering', 'Overige inkomsten'].includes(c);
}
