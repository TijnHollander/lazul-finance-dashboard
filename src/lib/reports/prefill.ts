import { get } from 'svelte/store';
import { rapport, profile, bankTx, categoryRules } from '$lib/stores';
import { portfolio } from '$lib/portfolio';
import { bereken } from '$lib/report';
import { categorize, summarize } from '$lib/cashflow';

/** Haalt bekende gegevens op uit het algemene rapport, je bankdata en je portfolio, om nieuwe rapporten voor te vullen. */
export function bekend() {
	const r = get(rapport).data;
	const p = get(profile);
	const pf = get(portfolio);
	const tx = get(bankTx);
	const res = r ? bereken(r, pf.totalValue + pf.cash) : null;
	let cf: ReturnType<typeof summarize> | null = null;
	if (tx.length) {
		const own = new Set(tx.map((t) => t.account).filter(Boolean));
		const rules = get(categoryRules);
		const cats = new Map(tx.map((t) => [t.id, categorize(t, own, rules)] as const));
		cf = summarize(tx, cats);
	}
	const geboortejaar = r?.geboortejaar ?? p?.birthYear ?? null;
	return {
		leeftijd: geboortejaar ? new Date().getFullYear() - geboortejaar : null,
		netto: r?.nettoInkomen ?? (cf ? Math.round(cf.wAvgIncome) : null),
		samenwonend: r?.samenwonend ?? false,
		kinderen: r?.kinderen ?? 0,
		woonsituatie: r?.woonsituatie ?? null,
		werkstatus: r?.werkstatus ?? null,
		spaargeld: r?.spaargeld ?? null,
		beleggingen: (r?.beleggingen ?? 0) + (pf.totalValue + pf.cash) || null,
		woningwaarde: r?.woningwaarde ?? null,
		hypotheek: r?.hypotheek ?? null,
		studieschuld: r?.studieschuld ?? null,
		overigeSchulden: r?.overigeSchulden ?? null,
		uitgaven: cf ? Math.round(cf.wAvgExpenses) : res ? Math.round(res.uitgaven) : null,
		vrijeRuimte: cf ? Math.round(cf.wAvgIncome - cf.wAvgExpenses) : res ? Math.round(res.vrijeRuimte) : null,
		maandBeleggen: res?.maandBeleggen ?? null
	};
}
