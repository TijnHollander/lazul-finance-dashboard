<script lang="ts">
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import Stat from '$lib/components/Stat.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import Chart from '$lib/components/Chart.svelte';
	import WealthCompare from '$lib/components/WealthCompare.svelte';
	import { profile, rapport, bankTx, categoryRules, holdingOverrides } from '$lib/stores';
	import { portfolio } from '$lib/portfolio';
	import { bereken } from '$lib/report';
	import { categorize, summarize } from '$lib/cashflow';
	import { fetchQuotes, fetchNews, isImportant, type NewsItem } from '$lib/market';
	import { euro, pct, monthLabel, timeAgo } from '$lib/format';
	import { SERIES, INK } from '$lib/palette';

	const res = $derived($rapport.data && $rapport.savedAt ? bereken($rapport.data, $portfolio.totalValue + $portfolio.cash) : null);
	const cf = $derived.by(() => {
		if (!$bankTx.length) return null;
		const own = new Set($bankTx.map((t) => t.account).filter(Boolean));
		const cats = new Map($bankTx.map((t) => [t.id, categorize(t, own, $categoryRules)] as const));
		const last = new Date($bankTx[$bankTx.length - 1].date);
		last.setMonth(last.getMonth() - 12);
		const from = last.toISOString().slice(0, 7);
		return summarize($bankTx.filter((t) => t.date.slice(0, 7) > from), cats);
	});

	let news = $state<NewsItem[]>([]);
	onMount(async () => {
		const syms = Object.values($holdingOverrides).map((o) => o.symbol).filter(Boolean) as string[];
		if (syms.length) fetchQuotes(syms);
		try {
			const r = await fetchNews(syms);
			news = r.items.filter(isImportant).slice(0, 5);
		} catch {
			/* geen nieuws */
		}
	});

	const hour = new Date().getHours();
	const groet = hour < 6 ? 'Goedenacht' : hour < 12 ? 'Goedemorgen' : hour < 18 ? 'Goedemiddag' : 'Goedenavond';
	const nettoVermogen = $derived(res ? res.vermogen.totaal : $portfolio.totalValue + $portfolio.cash);
	const overPerMaand = $derived(cf ? cf.wAvgIncome - cf.wAvgExpenses : res ? res.vrijeRuimte : null);
	const movers = $derived([...$portfolio.positions].filter((p) => p.dayChangePct != null && !p.hidden).sort((a, b) => Math.abs(b.dayChangePct!) - Math.abs(a.dayChangePct!)).slice(0, 5));

	const cfChart = $derived(
		cf
			? {
					type: 'bar',
					data: {
						labels: cf.months.slice(-6).map((m) => monthLabel(m.key)),
						datasets: [
							{ label: 'Inkomsten', data: cf.months.slice(-6).map((m) => Math.round(m.income)), backgroundColor: SERIES[2], borderRadius: 4, maxBarThickness: 16 },
							{ label: 'Uitgaven', data: cf.months.slice(-6).map((m) => Math.round(m.expenses)), backgroundColor: SERIES[1], borderRadius: 4, maxBarThickness: 16 }
						]
					},
					options: {
						maintainAspectRatio: false,
						interaction: { mode: 'index', intersect: false },
						scales: { x: { grid: { display: false } }, y: { grid: { color: INK.grid }, ticks: { callback: (v: any) => euro(v) } } },
						plugins: { legend: { position: 'top', align: 'end' }, tooltip: { callbacks: { label: (c: any) => ` ${c.dataset.label}: ${euro(c.parsed.y)}` } } }
					}
				}
			: null
	);

	const steps = $derived([
		{ done: $portfolio.hasData, href: '/portfolio/', title: 'Importeer je portfolio', text: 'CSV van Trading 212, DEGIRO, Trade Republic of ING.', icon: 'pie' },
		{ done: $bankTx.length > 0, href: '/uitgaven/', title: 'Importeer je bankafschrift', text: 'Zie je gemiddelde inkomsten en uitgaven per maand.', icon: 'wallet' },
		{ done: !!$rapport.savedAt, href: '/rapport/', title: 'Vul het rapport in', text: 'Vergelijk je vermogen met leeftijdsgenoten en krijg een plan.', icon: 'report' }
	]);
</script>

<svelte:head><title>Overzicht · Lazul Finance</title></svelte:head>

<header class="mb-8">
	<h1 class="text-2xl font-bold tracking-tight sm:text-3xl">{groet}, {$profile?.name}</h1>
	<p class="mt-1 text-sm text-white/50">{new Date().toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
</header>

{#if steps.some((s) => !s.done)}
	<section class="mb-8 grid gap-3 md:grid-cols-3">
		{#each steps as s, i (s.href)}
			<a href="{base}{s.href}" class="card group flex gap-4 transition-colors hover:border-purple-500/40 {s.done ? 'opacity-50' : ''}">
				<div class="grid size-10 shrink-0 place-items-center rounded-full border {s.done ? 'border-emerald-500/30 bg-emerald-950/40 text-emerald-300' : 'border-purple-500/30 bg-purple-950/40 text-purple-300'}">
					<Icon name={s.done ? 'check' : s.icon} />
				</div>
				<div>
					<div class="text-xs text-white/40">Stap {i + 1}</div>
					<div class="font-medium text-white group-hover:text-purple-200">{s.title}</div>
					<div class="text-sm text-white/50">{s.text}</div>
				</div>
			</a>
		{/each}
	</section>
{/if}

<section class="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
	<Stat label={res ? 'Netto vermogen' : 'Waarde beleggingen'} value={euro(nettoVermogen)} sub={res ? `${euro(res.vermogen.financieel)} spaargeld + beleggingen` : 'vul het rapport in voor je totale vermogen'} tone="brand" />
	<Stat label="Portfolio vandaag" value={$portfolio.hasData ? euro($portfolio.dayChange) : '—'} sub={$portfolio.hasData ? `${pct($portfolio.dayChangePct, 2)} · totaal ${pct($portfolio.unrealizedPct)}` : 'nog geen portfolio'} tone={$portfolio.dayChange >= 0 ? 'pos' : 'neg'} />
	<Stat label="Over per maand" value={overPerMaand != null ? euro(overPerMaand) : '—'} sub={cf ? 'gewogen gemiddelde uit je bank' : res ? 'volgens je rapport' : 'importeer je bankafschrift'} tone={overPerMaand != null && overPerMaand < 0 ? 'neg' : 'pos'} />
	<Stat label="Financiële score" value={res ? `${res.score}/100` : '—'} sub={res ? res.scoreLabel : 'na het invullen van het rapport'} />
</section>

<div class="grid gap-6 lg:grid-cols-3">
	<div class="flex min-w-0 flex-col gap-6 lg:col-span-2">
		{#if res}
			<section class="card">
				<div class="mb-4 flex items-center justify-between">
					<h2 class="font-semibold">Jij vs. leeftijdsgenoten</h2>
					<a class="text-xs text-purple-300 hover:underline" href="{base}/rapport/">Volledig rapport →</a>
				</div>
				<WealthCompare res={res} compact />
			</section>
		{:else}
			<a href="{base}/rapport/" class="card group relative overflow-hidden transition-colors hover:border-purple-500/40">
				<div class="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(147,51,234,0.25),transparent_60%)]"></div>
				<div class="relative">
					<h2 class="text-lg font-semibold">Loop jij voor of achter op je leeftijd?</h2>
					<p class="mt-1 max-w-lg text-sm text-white/60">De mediaan van Nederlandse huishoudens tussen 25 en 35 jaar heeft € 10.800 aan spaargeld en beleggingen. Vul in 5 minuten het rapport in en zie waar jij staat, en hoe snel je kunt groeien.</p>
					<span class="btn btn-primary mt-4">Start het rapport <Icon name="arrowright" /></span>
				</div>
			</a>
		{/if}

		{#if cfChart && cf}
			<section class="card">
				<div class="mb-3 flex items-center justify-between">
					<h2 class="font-semibold">Inkomsten & uitgaven</h2>
					<a class="text-xs text-purple-300 hover:underline" href="{base}/uitgaven/">Details →</a>
				</div>
				<Chart height={220} config={cfChart} />
				<div class="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-white/60">
					<span>Gem. inkomsten <b class="num text-white">{euro(cf.wAvgIncome)}</b></span>
					<span>Gem. uitgaven <b class="num text-white">{euro(cf.wAvgExpenses)}</b></span>
					<span>Grootste post <b class="text-white">{cf.categoryAvg[0]?.category ?? '—'}</b></span>
				</div>
			</section>
		{/if}
	</div>

	<div class="flex min-w-0 flex-col gap-6">
		{#if $portfolio.hasData}
			<section class="card">
				<div class="mb-3 flex items-center justify-between">
					<h2 class="font-semibold">Beweging vandaag</h2>
					<a class="text-xs text-purple-300 hover:underline" href="{base}/portfolio/">Portfolio →</a>
				</div>
				<ul class="space-y-2.5">
					{#each movers as p (p.key)}
						<li class="flex items-center justify-between gap-3 text-sm">
							<span class="truncate text-white/80">{p.name}</span>
							<span class="num shrink-0 {p.dayChangePct! >= 0 ? 'pos' : 'neg'}">{pct(p.dayChangePct, 2)}</span>
						</li>
					{:else}
						{#each $portfolio.positions.slice(0, 5) as p (p.key)}
							<li class="flex items-center justify-between gap-3 text-sm">
								<span class="truncate text-white/80">{p.name}</span>
								<span class="num shrink-0 text-white/60">{euro(p.valueEur)}</span>
							</li>
						{/each}
					{/each}
				</ul>
			</section>
		{/if}

		<section class="card">
			<div class="mb-3 flex items-center justify-between">
				<h2 class="font-semibold">Belangrijk nieuws</h2>
				<a class="text-xs text-purple-300 hover:underline" href="{base}/nieuws/">Alles →</a>
			</div>
			<ul class="space-y-3">
				{#each news as n (n.link)}
					<li>
						<a href={n.link} target="_blank" rel="noopener" class="group block">
							<div class="text-sm text-white/85 group-hover:text-purple-200">{n.title}</div>
							<div class="text-xs text-white/40">{n.source} · {timeAgo(n.published)}</div>
						</a>
					</li>
				{:else}
					<li class="text-sm text-white/40">Nog geen nieuws. Op Vercel werkt dit automatisch; op GitHub Pages met een Finnhub-sleutel.</li>
				{/each}
			</ul>
		</section>
	</div>
</div>
