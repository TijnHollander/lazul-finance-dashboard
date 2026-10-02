<script lang="ts">
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import Chart from '$lib/components/Chart.svelte';
	import Sparkline from '$lib/components/Sparkline.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import { watchlist, quotes, holdingOverrides } from '$lib/stores';
	import { fetchQuotes, fetchHistory, provider, searchSymbol, type Provider, type SearchResult } from '$lib/market';
	import { money, pct, timeAgo } from '$lib/format';
	import { SERIES, INK } from '$lib/palette';

	let prov = $state<Provider>('none');
	let loading = $state(false);
	let q = $state('');
	let results = $state<SearchResult[]>([]);
	let selected = $state<string | null>(null);
	let range = $state('6mo');
	let hist = $state<Awaited<ReturnType<typeof fetchHistory>>>(null);

	const portfolioSymbols = $derived([...new Set(Object.values($holdingOverrides).map((o) => o.symbol).filter(Boolean) as string[])]);

	onMount(async () => {
		prov = await provider();
		await load(true);
		selected = $watchlist[0] ?? null;
	});

	async function load(force = false) {
		loading = true;
		await fetchQuotes([...$watchlist, ...portfolioSymbols], { maxAgeMs: force ? 0 : 60_000 });
		loading = false;
	}

	$effect(() => {
		if (selected) fetchHistory(selected, range).then((h) => (hist = h));
	});

	let timer: ReturnType<typeof setTimeout>;
	function onSearch() {
		clearTimeout(timer);
		timer = setTimeout(async () => (results = q.trim().length > 1 ? await searchSymbol(q.trim()) : []), 300);
	}
	async function add(sym: string) {
		if (!$watchlist.includes(sym)) watchlist.update((w) => [...w, sym]);
		q = '';
		results = [];
		await fetchQuotes([sym], { maxAgeMs: 0 });
		selected = sym;
	}
	function remove(sym: string) {
		watchlist.update((w) => w.filter((s) => s !== sym));
		if (selected === sym) selected = $watchlist[0] ?? null;
	}

	const NAMES: Record<string, string> = { '^AEX': 'AEX-index', '^GSPC': 'S&P 500', '^IXIC': 'Nasdaq Composite', 'EURUSD=X': 'Euro / Dollar', 'BTC-EUR': 'Bitcoin in euro' };
	const selQuote = $derived(selected ? $quotes[selected] : null);
	const histUp = $derived(hist && hist.closes.length > 1 ? hist.closes[hist.closes.length - 1] >= hist.closes[0] : true);
	const histChange = $derived(hist && hist.closes.length > 1 ? (hist.closes[hist.closes.length - 1] / hist.closes[0] - 1) * 100 : null);
	const fmtT = (t: number) => {
		const d = new Date(t);
		return range === '1d' || range === '5d' ? d.toLocaleString('nl-NL', { weekday: 'short', hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: range === '5y' || range === 'max' ? '2-digit' : undefined });
	};
	const chartCfg = $derived({
		type: 'line',
		data: {
			labels: hist?.times.map(fmtT) ?? [],
			datasets: [{ label: selected ?? '', data: hist?.closes ?? [], borderColor: histUp ? '#34d399' : '#f87171', backgroundColor: histUp ? 'rgba(52,211,153,0.08)' : 'rgba(248,113,113,0.08)', fill: true, borderWidth: 2, pointRadius: 0, tension: 0.15 }]
		},
		options: {
			maintainAspectRatio: false,
			interaction: { mode: 'index', intersect: false },
			scales: { x: { grid: { display: false }, ticks: { maxTicksLimit: 7, maxRotation: 0 } }, y: { grid: { color: INK.grid }, ticks: { callback: (v: any) => money(v, hist?.currency === 'GBp' ? 'GBP' : hist?.currency ?? 'EUR') } } },
			plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c: any) => ` ${money(c.parsed.y, hist?.currency === 'GBp' ? 'GBP' : hist?.currency ?? 'EUR')}` } } }
		}
	});
</script>

<svelte:head><title>Markt · Lazul Finance</title></svelte:head>

<header class="mb-8 flex flex-wrap items-end justify-between gap-4">
	<div>
		<h1 class="text-2xl font-bold tracking-tight sm:text-3xl">Markt</h1>
		<p class="mt-1 text-sm text-white/50">Je volglijst met koersen. Ze lopen ook bovenin mee als tickerband.</p>
	</div>
	<button class="btn btn-primary" onclick={() => load(true)} disabled={loading}><Icon name="refresh" class="size-4 {loading ? 'animate-spin' : ''}" /> Verversen</button>
</header>

{#if prov === 'none'}
	<div class="mb-6 flex items-start gap-3 rounded-lg border border-yellow-500/20 bg-yellow-950/20 px-4 py-3 text-sm text-yellow-100">
		<Icon name="info" class="mt-0.5 size-4 shrink-0" />
		<div>Er is geen koersbron actief. Op Vercel werkt dit automatisch. Op GitHub Pages heb je een gratis <a class="underline" href="https://finnhub.io/register" target="_blank" rel="noopener">Finnhub-sleutel</a> nodig; vul die in bij <a class="underline" href="{base}/instellingen/">Instellingen</a>.</div>
	</div>
{:else if prov === 'finnhub'}
	<p class="mb-6 text-xs text-white/45">Koersen via Finnhub (gratis): Amerikaanse aandelen werken, Europese notaties (.AS, .DE) en grafieken vaak niet. Op Vercel gehost krijg je alles via Yahoo Finance.</p>
{/if}

<div class="grid gap-6 lg:grid-cols-5">
	<section class="card p-0 lg:col-span-2">
		<div class="relative border-b border-white/10 p-4">
			<div class="relative">
				<input class="input pl-9" placeholder="Ticker of bedrijf toevoegen…" bind:value={q} oninput={onSearch} disabled={prov === 'none'} />
				<Icon name="search" class="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-white/40" />
			</div>
			{#if results.length}
				<ul class="absolute inset-x-4 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-lg border border-white/10 bg-black p-1 shadow-2xl">
					{#each results as r (r.symbol)}
						<li>
							<button class="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm hover:bg-white/5" onclick={() => add(r.symbol)}>
								<span class="w-24 shrink-0 font-mono text-purple-200">{r.symbol}</span>
								<span class="flex-1 truncate text-white/75">{r.name}</span>
								<span class="text-xs text-white/40">{r.exchange}</span>
							</button>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
		<ul class="divide-y divide-white/5">
			{#each $watchlist as s (s)}
				{@const qt = $quotes[s]}
				<li class="group flex items-center gap-3 px-4 py-3 transition-colors {selected === s ? 'bg-purple-950/30' : 'hover:bg-white/[0.02]'}">
					<button class="flex min-w-0 flex-1 items-center gap-3 text-left" onclick={() => (selected = s)}>
						<div class="min-w-0 flex-1">
							<div class="font-mono text-sm text-white">{s}</div>
							<div class="truncate text-xs text-white/45">{NAMES[s] ?? qt?.name ?? ''}</div>
						</div>
						<Sparkline values={qt?.spark ?? []} width={70} height={24} />
						<div class="w-24 text-right">
							{#if qt && !qt.error && isFinite(qt.price)}
								<div class="num text-sm">{money(qt.price, qt.currency === 'GBp' ? 'GBP' : qt.currency)}</div>
								<div class="num text-xs {qt.changePct >= 0 ? 'pos' : 'neg'}">{pct(qt.changePct, 2)}</div>
							{:else}
								<div class="text-xs text-white/30">{qt?.error ? 'n.v.t.' : '—'}</div>
							{/if}
						</div>
					</button>
					<button class="rounded p-1 text-white/30 opacity-0 group-hover:opacity-100 hover:text-red-300" aria-label="Verwijderen" onclick={() => remove(s)}><Icon name="x" class="size-3.5" /></button>
				</li>
			{/each}
		</ul>
		{#if portfolioSymbols.length}
			<div class="border-t border-white/10 px-4 py-3 text-xs text-white/45">
				Uit je portfolio:
				{#each portfolioSymbols.filter((s) => !$watchlist.includes(s)) as s (s)}
					<button class="chip mr-1 mb-1 font-mono hover:border-purple-400/40" onclick={() => add(s)}>+ {s}</button>
				{/each}
			</div>
		{/if}
	</section>

	<section class="card lg:col-span-3">
		{#if selected}
			<div class="mb-4 flex flex-wrap items-start justify-between gap-3">
				<div>
					<div class="font-mono text-sm text-purple-200">{selected}</div>
					<div class="text-lg font-semibold">{NAMES[selected] ?? selQuote?.name ?? hist?.name ?? selected}</div>
					{#if selQuote && !selQuote.error && isFinite(selQuote.price)}
						<div class="mt-1 flex items-baseline gap-3">
							<span class="num text-3xl font-bold">{money(selQuote.price, selQuote.currency === 'GBp' ? 'GBP' : selQuote.currency)}</span>
							<span class="num {selQuote.changePct >= 0 ? 'pos' : 'neg'}">{pct(selQuote.changePct, 2)} vandaag</span>
						</div>
						<div class="text-xs text-white/40">{selQuote.exchange ?? ''} · bijgewerkt {timeAgo(selQuote.fetchedAt)}</div>
					{/if}
				</div>
				<div class="flex gap-1 rounded-lg border border-white/10 p-1">
					{#each [['1d', '1D'], ['5d', '1W'], ['1mo', '1M'], ['6mo', '6M'], ['1y', '1J'], ['5y', '5J']] as [r, l] (r)}
						<button class="rounded-md px-2.5 py-1 text-xs {range === r ? 'bg-purple-950/60 text-purple-200' : 'text-white/55 hover:text-white'}" onclick={() => (range = r)}>{l}</button>
					{/each}
				</div>
			</div>
			{#if hist && hist.closes.length > 1}
				<div class="mb-2 text-sm {histUp ? 'pos' : 'neg'}">{pct(histChange, 2)} in deze periode</div>
				<Chart height={340} config={chartCfg} />
			{:else}
				<div class="grid h-[340px] place-items-center rounded-lg border border-dashed border-white/10 text-sm text-white/40">
					{prov === 'api' ? 'Grafiek laden…' : 'Grafieken zijn beschikbaar als de app op Vercel draait.'}
				</div>
			{/if}
		{:else}
			<div class="grid h-80 place-items-center text-sm text-white/40">Kies een ticker uit je volglijst.</div>
		{/if}
	</section>
</div>
