<script lang="ts">
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import Icon from '$lib/components/Icon.svelte';
	import { holdingOverrides } from '$lib/stores';
	import { portfolio } from '$lib/portfolio';
	import { fetchNews, isImportant, type NewsItem, type Provider } from '$lib/market';
	import { timeAgo } from '$lib/format';

	let items = $state<NewsItem[]>([]);
	let prov = $state<Provider>('none');
	let loading = $state(true);
	let error = $state<string | null>(null);
	let filter = $state<'belangrijk' | 'alles' | 'portfolio' | 'nl'>('belangrijk');
	let broken = $state<Record<string, boolean>>({});

	const symbols = $derived([...new Set(Object.values($holdingOverrides).map((o) => o.symbol).filter(Boolean) as string[])]);
	/** Woorden uit je posities om algemeen nieuws aan je portfolio te koppelen (bijv. "ASML", "Nvidia"). */
	const keywords = $derived(
		$portfolio.positions
			.filter((p) => !p.hidden)
			.map((p) => p.name.split(/[\s(]/)[0])
			.filter((w) => w.length > 2 && !/^(ishares|vanguard|vaneck|xtrackers|spdr|amundi|invesco|core|msci|ftse)$/i.test(w))
	);

	async function load() {
		loading = true;
		error = null;
		try {
			const r = await fetchNews(symbols);
			prov = r.provider;
			const kw = keywords.length ? new RegExp(`\\b(${keywords.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`, 'i') : null;
			items = r.items.map((n) => (kw && kw.test(n.title) && !n.symbols.length ? { ...n, symbols: ['portfolio'] } : n));
		} catch (e) {
			error = 'Nieuws kon niet worden geladen.';
		}
		loading = false;
	}
	onMount(load);

	const shown = $derived(
		items.filter((n) =>
			filter === 'alles' ? true : filter === 'belangrijk' ? isImportant(n) : filter === 'portfolio' ? n.symbols.length > 0 : n.lang === 'nl'
		)
	);
	const lead = $derived(shown.find((n) => n.image && !broken[n.image]));
</script>

<svelte:head><title>Nieuws · Lazul Finance</title></svelte:head>

<header class="mb-6 flex flex-wrap items-end justify-between gap-4">
	<div>
		<h1 class="text-2xl font-bold tracking-tight sm:text-3xl">Nieuws</h1>
		<p class="mt-1 text-sm text-white/50">Markt- en economienieuws, met voorrang voor nieuws over jouw posities en grote macrogebeurtenissen.</p>
	</div>
	<button class="btn btn-primary" onclick={load} disabled={loading}><Icon name="refresh" class="size-4 {loading ? 'animate-spin' : ''}" /> Verversen</button>
</header>

<div class="mb-6 flex flex-wrap gap-2">
	{#each [['belangrijk', 'Belangrijk'], ['portfolio', 'Mijn portfolio'], ['nl', 'Nederlands'], ['alles', 'Alles']] as [k, l] (k)}
		<button class="btn {filter === k ? 'btn-primary' : 'btn-ghost'} py-1.5" onclick={() => (filter = k as typeof filter)}>{l}</button>
	{/each}
</div>

{#if prov === 'none' && !loading}
	<div class="flex items-start gap-3 rounded-lg border border-yellow-500/20 bg-yellow-950/20 px-4 py-3 text-sm text-yellow-100">
		<Icon name="info" class="mt-0.5 size-4 shrink-0" />
		<div>Nieuws heeft een bron nodig: host de app op Vercel (NOS, CNBC en Yahoo Finance via RSS, geen sleutel nodig) of vul een gratis Finnhub-sleutel in bij <a class="underline" href="{base}/instellingen/">Instellingen</a>.</div>
	</div>
{:else if error}
	<p class="text-sm text-red-300">{error}</p>
{:else if loading}
	<div class="grid gap-3">{#each Array(6) as _, i (i)}<div class="h-20 animate-pulse rounded-xl bg-white/[0.03]"></div>{/each}</div>
{:else}
	{#if lead}
		<a href={lead.link} target="_blank" rel="noopener" class="card group mb-6 grid gap-5 overflow-hidden p-0 transition-colors hover:border-purple-500/40 md:grid-cols-2">
			<img src={lead.image} alt="" class="h-56 w-full object-cover md:h-full" loading="lazy" referrerpolicy="no-referrer" onerror={() => (broken[lead.image!] = true)} />
			<div class="flex flex-col justify-center gap-2 p-6">
				<div class="flex items-center gap-2 text-xs text-white/45"><span class="chip text-purple-200">{lead.source}</span>{timeAgo(lead.published)}</div>
				<h2 class="text-xl font-semibold group-hover:text-purple-200">{lead.title}</h2>
				<p class="line-clamp-3 text-sm text-white/60">{lead.summary}</p>
			</div>
		</a>
	{/if}
	<ul class="grid gap-3 md:grid-cols-2">
		{#each shown.filter((n) => n !== lead) as n (n.link)}
			<li>
				<a href={n.link} target="_blank" rel="noopener" class="card flex h-full gap-4 transition-colors hover:border-purple-500/40">
					<div class="min-w-0 flex-1">
						<div class="mb-1 flex flex-wrap items-center gap-2 text-xs text-white/45">
							<span>{n.source}</span>·<span>{timeAgo(n.published)}</span>
							{#each n.symbols.filter((s) => s !== 'portfolio') as s (s)}<span class="chip font-mono text-purple-200">{s}</span>{/each}
							{#if n.symbols.includes('portfolio')}<span class="chip text-purple-200">jouw portfolio</span>{/if}
						</div>
						<h3 class="font-medium text-white">{n.title}</h3>
						{#if n.summary}<p class="mt-1 line-clamp-2 text-sm text-white/50">{n.summary}</p>{/if}
					</div>
					{#if n.image && !broken[n.image]}<img src={n.image} alt="" class="size-20 shrink-0 rounded-lg object-cover" loading="lazy" referrerpolicy="no-referrer" onerror={() => (broken[n.image!] = true)} />{/if}
				</a>
			</li>
		{:else}
			<li class="text-sm text-white/45">Geen berichten in deze selectie.</li>
		{/each}
	</ul>
{/if}
