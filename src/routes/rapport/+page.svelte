<script lang="ts">
	import { base } from '$app/paths';
	import Icon from '$lib/components/Icon.svelte';
	import { rapport, hypotheekRapport, belastingRapport, pensioenRapport, doelenRapport, schuldenRapport } from '$lib/stores';
	import { portfolio } from '$lib/portfolio';
	import { bereken } from '$lib/report';
	import { berekenHypotheek } from '$lib/reports/hypotheek';
	import { berekenBelasting } from '$lib/reports/belasting';
	import { berekenPensioen } from '$lib/reports/pensioen';
	import { berekenDoelen } from '$lib/reports/doelen';
	import { berekenSchulden } from '$lib/reports/schulden';
	import { euro, compactEuro, dateNl } from '$lib/format';

	const alg = $derived($rapport.data && $rapport.savedAt ? bereken($rapport.data, $portfolio.totalValue + $portfolio.cash) : null);
	const hyp = $derived($hypotheekRapport.data ? berekenHypotheek($hypotheekRapport.data) : null);
	const bel = $derived($belastingRapport.data ? berekenBelasting($belastingRapport.data) : null);
	const pen = $derived($pensioenRapport.data ? berekenPensioen($pensioenRapport.data) : null);
	const doe = $derived($doelenRapport.data ? berekenDoelen($doelenRapport.data) : null);
	const sch = $derived($schuldenRapport.data ? berekenSchulden($schuldenRapport.data) : null);

	type Card = { href: string; titel: string; tekst: string; icon: string; savedAt: string | null; resultaat: string | null; sub?: string; tone?: 'pos' | 'warn' | 'neg' };
	const cards = $derived<Card[]>([
		{
			href: '/rapport/algemeen/',
			titel: 'Algemeen rapport',
			tekst: 'Je financiële foto: inkomen, uitgaven, buffer, score en hoe je ervoor staat ten opzichte van leeftijdsgenoten.',
			icon: 'report',
			savedAt: $rapport.savedAt,
			resultaat: alg ? `Score ${alg.score}/100` : null,
			sub: alg ? `${alg.scoreLabel} · ${euro(alg.vrijeRuimte)} vrije ruimte p/m` : undefined,
			tone: alg ? (alg.score >= 65 ? 'pos' : alg.score >= 45 ? 'warn' : 'neg') : undefined
		},
		{
			href: '/rapport/doelen/',
			titel: 'Spaardoelen & FIRE',
			tekst: 'Wat moet je per maand opzij zetten voor je doelen, en wanneer ben je financieel onafhankelijk?',
			icon: 'star',
			savedAt: $doelenRapport.savedAt,
			resultaat: doe ? `${euro(doe.totaalPerMaand)} p/m voor ${doe.doelen.length} doelen` : null,
			sub: doe?.fireLeeftijd ? `Financieel vrij rond je ${doe.fireLeeftijd}e` : doe ? `FIRE-getal ${compactEuro(doe.fireGetal)}` : undefined,
			tone: doe ? (doe.pastInRuimte === false ? 'warn' : 'pos') : undefined
		},
		{
			href: '/rapport/schulden/',
			titel: 'Schulden aflossen',
			tekst: 'Een aflosplan met de lawine- of sneeuwbalmethode: hoe snel ben je schuldenvrij en hoeveel rente bespaar je?',
			icon: 'chart',
			savedAt: $schuldenRapport.savedAt,
			resultaat: sch && sch.totaal > 0 ? `${euro(sch.totaal)} schuld` : sch ? 'Geen schulden' : null,
			sub: sch && sch.lawine.maanden ? `Schuldenvrij in ${Math.ceil(sch.lawine.maanden / 12)} jaar` : undefined,
			tone: sch ? (sch.totaal === 0 ? 'pos' : 'warn') : undefined
		},
		{
			href: '/rapport/hypotheek/',
			titel: 'Hypotheek & koophuis',
			tekst: 'Hoeveel kun je lenen, wat kost een huis netto per maand, NHG en startersvrijstelling, en loont oversluiten?',
			icon: 'home',
			savedAt: $hypotheekRapport.savedAt,
			resultaat: hyp && $hypotheekRapport.savedAt ? ($hypotheekRapport.data?.situatie === 'oversluiten' ? (hyp.oversluiten && hyp.oversluiten.besparing > 0 ? `${euro(hyp.oversluiten.besparing)} p/m besparing` : 'Oversluiten niet voordelig') : `Max. hypotheek ${euro(hyp.maxHypotheek)}`) : null,
			sub: hyp && $hypotheekRapport.data?.woningprijs && $hypotheekRapport.data.situatie !== 'oversluiten' ? `${euro(hyp.maandNetto)} netto p/m` : undefined,
			tone: hyp ? (hyp.oordeel === 'groen' ? 'pos' : hyp.oordeel === 'oranje' ? 'warn' : 'neg') : undefined
		},
		{
			href: '/rapport/belasting/',
			titel: 'Belastingvoordelen',
			tekst: 'Jaarruimte, hypotheekrenteaftrek, box 3, giften, schenken en ondernemersregelingen, met de bedragen van 2026.',
			icon: 'wallet',
			savedAt: $belastingRapport.savedAt,
			resultaat: bel && $belastingRapport.savedAt ? `± ${euro(bel.totaalVoordeel)} per jaar te halen` : null,
			sub: bel ? `${bel.tips.filter((t) => t.prioriteit === 'hoog').length} belangrijke tips` : undefined,
			tone: 'pos'
		},
		{
			href: '/rapport/pensioen/',
			titel: 'Pensioen & AOW-gat',
			tekst: 'AOW, werkgeverspensioen en wat je zelf moet aanvullen om straks prettig te leven, ook als je eerder wilt stoppen.',
			icon: 'pie',
			savedAt: $pensioenRapport.savedAt,
			resultaat: pen && $pensioenRapport.savedAt ? (pen.maandNodig > 0 ? `${euro(pen.maandNodig)} p/m extra nodig` : 'Op koers') : null,
			sub: pen && $pensioenRapport.savedAt ? `Doel ${euro(pen.doelNetto)} netto p/m` : undefined,
			tone: pen ? (pen.maandNodig > 0 ? 'warn' : 'pos') : undefined
		}
	]);

	// slimme volgorde: wat is nu het belangrijkst?
	const advies = $derived.by(() => {
		if (!$rapport.savedAt) return { href: '/rapport/algemeen/', tekst: 'Begin met het algemene rapport: de andere rapporten worden dan automatisch vooringevuld.' };
		if (alg && ($rapport.data?.overigeSchulden ?? 0) > 0 && !$schuldenRapport.savedAt) return { href: '/rapport/schulden/', tekst: 'Je hebt dure schulden: maak eerst een aflosplan.' };
		if (alg && alg.buffer.status === 'te_laag' && !$doelenRapport.savedAt) return { href: '/rapport/doelen/', tekst: 'Je buffer is nog niet op peil: zet hem als eerste spaardoel neer.' };
		if (!$belastingRapport.savedAt) return { href: '/rapport/belasting/', tekst: 'Check of je geen belastingvoordeel laat liggen: dat is vaak het snelst verdiende geld.' };
		if (!$pensioenRapport.savedAt) return { href: '/rapport/pensioen/', tekst: 'Kijk of je pensioen op koers ligt; hoe eerder je bijstuurt, hoe goedkoper.' };
		return null;
	});
	const toneCls = { pos: 'text-emerald-300', warn: 'text-yellow-100', neg: 'text-red-300' };
	const ingevuld = $derived(cards.filter((c) => c.savedAt).length);
</script>

<svelte:head><title>Rapporten · Lazul Finance</title></svelte:head>

<header class="mb-8 flex flex-wrap items-end justify-between gap-4">
	<div>
		<h1 class="text-2xl font-bold tracking-tight sm:text-3xl">Rapporten</h1>
		<p class="mt-1 text-sm text-white/50">Zes rapporten die samen je hele financiële situatie in kaart brengen. Gegevens die je één keer invult, worden in de andere rapporten hergebruikt.</p>
	</div>
	<div class="text-right">
		<div class="num text-2xl font-semibold">{ingevuld}<span class="text-white/40">/6</span></div>
		<div class="text-xs text-white/45">ingevuld</div>
	</div>
</header>

{#if advies}
	<a href="{base}{advies.href}" class="mb-6 flex items-center gap-3 rounded-xl border border-purple-500/30 bg-purple-950/30 px-5 py-4 text-sm text-purple-100 transition-colors hover:bg-purple-950/50">
		<Icon name="star" class="size-5 shrink-0 text-purple-300" />
		<span class="flex-1"><b>Volgende stap:</b> {advies.tekst}</span>
		<Icon name="arrowright" />
	</a>
{/if}

<div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
	{#each cards as c (c.href)}
		<a href="{base}{c.href}" class="card group flex flex-col gap-3 transition-colors hover:border-purple-500/40">
			<div class="flex items-start justify-between">
				<div class="grid size-10 place-items-center rounded-lg border border-purple-500/30 bg-purple-950/40 text-purple-300"><Icon name={c.icon} class="size-5" /></div>
				{#if c.savedAt}<span class="chip text-emerald-300">✓ {dateNl(c.savedAt)}</span>{:else}<span class="chip">Nog niet ingevuld</span>{/if}
			</div>
			<div>
				<h2 class="font-semibold text-white group-hover:text-purple-200">{c.titel}</h2>
				<p class="mt-1 text-sm text-white/55">{c.tekst}</p>
			</div>
			<div class="mt-auto border-t border-white/10 pt-3">
				{#if c.resultaat}
					<div class="font-medium {c.tone ? toneCls[c.tone] : 'text-white'}">{c.resultaat}</div>
					{#if c.sub}<div class="text-xs text-white/45">{c.sub}</div>{/if}
				{:else}
					<span class="inline-flex items-center gap-1 text-sm text-purple-300">Invullen <Icon name="arrowright" class="size-3.5" /></span>
				{/if}
			</div>
		</a>
	{/each}
</div>

<p class="mt-8 text-xs text-white/35">Alle rapporten zijn educatieve indicaties op basis van wat je invult en de regels van 2026, geen persoonlijk financieel advies. Alles blijft opgeslagen in je eigen browser.</p>
