<script lang="ts">
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import DropZone from '$lib/components/DropZone.svelte';
	import MappingDialog from '$lib/components/MappingDialog.svelte';
	import Chart from '$lib/components/Chart.svelte';
	import Stat from '$lib/components/Stat.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import Sparkline from '$lib/components/Sparkline.svelte';
	import LiveBadge from '$lib/components/LiveBadge.svelte';
	import { readFileText, type CsvTable } from '$lib/parsers/csv';
	import { parsePortfolioFile, buildPortfolio, PF_FIELD_LABELS, PF_FIELDS_BY_MODE, type PfMapping, type PfMode } from '$lib/parsers/portfolio';
	import { portfolioImports, holdingOverrides } from '$lib/stores';
	import { portfolio, type Position } from '$lib/portfolio';
	import { fetchQuotes, fetchFx, provider, resolveSymbol, searchSymbol, type Provider, type SearchResult } from '$lib/market';
	import { euro, money, pct, qty, dateNl, uid } from '$lib/format';
	import { SERIES } from '$lib/palette';

	let pending = $state<{ file: string; table: CsvTable; mapping: PfMapping; confident: boolean; queue: File[] } | null>(null);
	let cols = $state<Record<string, number | undefined>>({});
	let mode = $state<PfMode>('transactions');
	let prov = $state<Provider>('none');
	let busy = $state(false);
	let msg = $state<string | null>(null);

	onMount(async () => {
		prov = await provider();
		await fetchFx();
		refresh();
	});

	async function refresh(force = false) {
		const syms = Object.values($holdingOverrides).map((o) => o.symbol).filter(Boolean) as string[];
		if (syms.length) await fetchQuotes(syms, { maxAgeMs: force ? 0 : 60_000 });
	}

	async function handleFiles(files: File[]) {
		const [first, ...rest] = files;
		const text = await readFileText(first);
		const p = parsePortfolioFile(text);
		mode = p.mapping.mode;
		cols = { ...p.mapping.cols };
		pending = { file: first.name, table: p.table, mapping: p.mapping, confident: p.confident, queue: rest };
	}

	const previewResult = $derived(
		pending ? buildPortfolio(pending.table, { ...pending.mapping, mode, cols: cols as PfMapping['cols'] }, { id: 'preview', fileName: pending.file }) : null
	);

	async function confirmImport() {
		if (!pending || !previewResult) return;
		const imp = { ...previewResult, id: uid() };
		portfolioImports.update((list) => [...list, imp]);
		const queue = pending.queue;
		pending = null;
		await linkSymbols();
		if (queue.length) handleFiles(queue);
	}

	/** Zoekt voor posities zonder symbool automatisch het beurssymbool op (via ISIN). */
	async function linkSymbols() {
		if (prov === 'none') return;
		busy = true;
		msg = 'Beurssymbolen opzoeken…';
		const todo = $portfolio.positions.filter((p) => !$holdingOverrides[p.key]?.symbol && $holdingOverrides[p.key]?.manualPrice == null);
		let found = 0;
		for (const p of todo) {
			const s = await resolveSymbol(p.isin, p.ticker, p.name);
			if (s) {
				found++;
				holdingOverrides.update((o) => ({ ...o, [p.key]: { ...o[p.key], symbol: s } }));
			}
		}
		msg = todo.length ? `${found} van ${todo.length} symbolen gekoppeld.` : null;
		await refresh(true);
		busy = false;
		setTimeout(() => (msg = null), 4000);
	}

	function removeImport(id: string) {
		if (confirm('Deze import verwijderen?')) portfolioImports.update((l) => l.filter((i) => i.id !== id));
	}

	// ── symbool koppelen per positie
	let editing = $state<Position | null>(null);
	let q = $state('');
	let results = $state<SearchResult[]>([]);
	let manual = $state<number | null>(null);
	async function openEdit(p: Position) {
		editing = p;
		q = p.isin ?? p.ticker ?? p.name;
		manual = $holdingOverrides[p.key]?.manualPrice ?? null;
		results = prov !== 'none' ? await searchSymbol(q) : [];
	}
	async function doSearch() {
		results = await searchSymbol(q);
	}
	async function choose(sym: string | null) {
		if (!editing) return;
		const k = editing.key;
		holdingOverrides.update((o) => ({ ...o, [k]: { ...o[k], symbol: sym ?? undefined, manualPrice: undefined } }));
		editing = null;
		if (sym) await fetchQuotes([sym], { maxAgeMs: 0 });
	}
	function saveManual() {
		if (!editing) return;
		const k = editing.key;
		holdingOverrides.update((o) => ({ ...o, [k]: { ...o[k], manualPrice: manual ?? undefined } }));
		editing = null;
	}
	function toggleHidden(p: Position) {
		holdingOverrides.update((o) => ({ ...o, [p.key]: { ...o[p.key], hidden: !o[p.key]?.hidden } }));
	}

	// ── allocatie: top 7 + overig, kleur volgt positie (vaste volgorde op waarde)
	const alloc = $derived.by(() => {
		const vis = $portfolio.positions.filter((p) => !p.hidden && (p.valueEur ?? 0) > 0);
		const top = vis.slice(0, 7);
		const rest = vis.slice(7).reduce((a, p) => a + (p.valueEur ?? 0), 0);
		const items = top.map((p, i) => ({ label: p.name, value: p.valueEur ?? 0, color: SERIES[i] }));
		if (rest > 0) items.push({ label: 'Overig', value: rest, color: '#52525b' });
		if ($portfolio.cash > 0) items.push({ label: 'Contant', value: $portfolio.cash, color: '#3f3f46' });
		return items;
	});
	const total = $derived(alloc.reduce((a, b) => a + b.value, 0));

	const SOURCE_LABEL = { live: 'live', handmatig: 'handmatig', bestand: 'uit bestand', geen: 'geen koers' };
</script>

<svelte:head><title>Portfolio · Lazul Finance</title></svelte:head>

<header class="mb-8 flex flex-wrap items-end justify-between gap-4">
	<div>
		<h1 class="text-2xl font-bold tracking-tight sm:text-3xl">Portfolio</h1>
		<p class="mt-1 text-sm text-white/50">Importeer de export van je broker. Alles wordt alleen in deze browser opgeslagen.</p>
	</div>
	{#if $portfolio.hasData}
		<div class="flex flex-wrap items-center gap-2">
			{#if prov !== 'none'}<LiveBadge />{/if}
			<button class="btn btn-ghost" onclick={linkSymbols} disabled={busy || prov === 'none'}><Icon name="search" /> Symbolen koppelen</button>
			<button class="btn btn-ghost" onclick={() => refresh(true)} disabled={busy} aria-label="Nu verversen" title="Nu verversen"><Icon name="refresh" /></button>
		</div>
	{/if}
</header>

{#if msg}<div class="mb-4 rounded-lg border border-purple-500/20 bg-purple-950/30 px-4 py-2 text-sm text-purple-200">{msg}</div>{/if}

{#if prov === 'none' && $portfolio.hasData}
	<div class="mb-6 flex items-start gap-3 rounded-lg border border-yellow-500/20 bg-yellow-950/20 px-4 py-3 text-sm text-yellow-100">
		<Icon name="info" class="mt-0.5 size-4 shrink-0" />
		<div>Geen live koersen beschikbaar. Host de app op Vercel (koersen werken dan automatisch) of vul een gratis Finnhub-sleutel in bij <a class="underline" href="{base}/instellingen/">Instellingen</a>. Tot die tijd gebruiken we de koersen uit je bestand of een handmatige koers.</div>
	</div>
{/if}

{#if $portfolio.hasData}
	<section class="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
		<Stat label="Waarde beleggingen" value={euro($portfolio.totalValue + $portfolio.cash)} sub={$portfolio.cash ? `waarvan ${euro($portfolio.cash)} contant` : `${$portfolio.positions.filter((p) => !p.hidden).length} posities`} tone="brand" />
		<Stat label="Ongerealiseerd resultaat" value={euro($portfolio.unrealized)} sub={$portfolio.totalCost ? `${pct($portfolio.unrealizedPct)} op ${euro($portfolio.totalCost)} inleg` : 'aankoopwaarde onbekend'} tone={$portfolio.unrealized >= 0 ? 'pos' : 'neg'} />
		<Stat label="Vandaag" value={euro($portfolio.dayChange)} sub={pct($portfolio.dayChangePct, 2)} tone={$portfolio.dayChange >= 0 ? 'pos' : 'neg'} />
		<Stat label="Dividend & gerealiseerd" value={euro($portfolio.dividends + $portfolio.realized)} sub={`${euro($portfolio.dividends)} dividend · ${euro($portfolio.realized)} verkoopresultaat`} />
	</section>

	<section class="mb-6 grid gap-4 lg:grid-cols-3">
		<div class="card lg:col-span-1">
			<h2 class="card-title mb-3">Verdeling</h2>
			<Chart
				height={220}
				config={{
					type: 'doughnut',
					data: { labels: alloc.map((a) => a.label), datasets: [{ data: alloc.map((a) => a.value), backgroundColor: alloc.map((a) => a.color), borderColor: '#000', borderWidth: 2, hoverOffset: 4 }] },
					options: {
						cutout: '68%',
						maintainAspectRatio: false,
						plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c: any) => ` ${c.label}: ${euro(c.parsed as number)} (${(((c.parsed as number) / total) * 100).toFixed(1)}%)` } } }
					}
				}}
			/>
			<ul class="mt-4 space-y-1.5 text-sm">
				{#each alloc as a (a.label)}
					<li class="flex items-center gap-2">
						<span class="size-2.5 shrink-0 rounded-sm" style="background:{a.color}"></span>
						<span class="flex-1 truncate text-white/75">{a.label}</span>
						<span class="num text-white/55">{((a.value / total) * 100).toFixed(1)}%</span>
					</li>
				{/each}
			</ul>
		</div>

		<div class="card lg:col-span-2">
			<h2 class="card-title mb-3">Geïmporteerde bestanden</h2>
			<ul class="divide-y divide-white/5">
				{#each $portfolioImports as imp (imp.id)}
					<li class="flex flex-wrap items-center gap-3 py-3">
						<div class="min-w-0 flex-1">
							<div class="text-sm font-medium">{imp.broker}</div>
							<div class="truncate text-xs text-white/45">
								{imp.fileName} · {imp.holdings.length} posities · {imp.txCount} regels{imp.firstDate ? ` · ${dateNl(imp.firstDate)} – ${dateNl(imp.lastDate!)}` : ''}
							</div>
							{#each imp.warnings as w (w)}<div class="mt-1 text-xs text-yellow-200/80">⚠ {w}</div>{/each}
						</div>
						{#if imp.deposits}<span class="chip">inleg {euro(imp.deposits - imp.withdrawals)}</span>{/if}
						<button class="rounded-md p-2 text-white/40 hover:bg-red-950/40 hover:text-red-300" aria-label="Import verwijderen" onclick={() => removeImport(imp.id)}><Icon name="trash" /></button>
					</li>
				{/each}
			</ul>
			<div class="mt-4">
				<DropZone onfiles={handleFiles} title="Nog een export toevoegen" hint="Meerdere brokers? Importeer ze allemaal; dezelfde fondsen worden samengevoegd." />
			</div>
		</div>
	</section>

	<section class="card overflow-hidden p-0">
		<div class="overflow-x-auto">
			<table class="table">
				<thead>
					<tr>
						<th>Positie</th>
						<th class="text-right">Aantal</th>
						<th class="text-right">Koers</th>
						<th class="hidden md:table-cell">1 mnd</th>
						<th class="text-right">Waarde</th>
						<th class="text-right">Resultaat</th>
						<th class="text-right">Weging</th>
						<th></th>
					</tr>
				</thead>
				<tbody>
					{#each $portfolio.positions as p (p.key)}
						<tr class={p.hidden ? 'opacity-40' : ''}>
							<td class="max-w-72">
								<div class="truncate font-medium text-white">{p.name}</div>
								<div class="flex flex-wrap items-center gap-1.5 text-xs text-white/40">
									<button class="rounded border border-white/10 px-1.5 py-0.5 font-mono text-[11px] text-purple-200 hover:border-purple-400/50" onclick={() => openEdit(p)} title="Beurssymbool of koers aanpassen">
										{p.symbol ?? 'koppel symbool'}
									</button>
									{#if p.isin}<span class="font-mono">{p.isin}</span>{/if}
									<span class="chip px-1.5 py-0 text-[10px] {p.priceSource === 'live' ? 'text-emerald-300' : p.priceSource === 'geen' ? 'text-red-300' : ''}">{SOURCE_LABEL[p.priceSource]}</span>
								</div>
							</td>
							<td class="num text-right">{qty(p.quantity)}</td>
							<td class="num text-right">
								{money(p.priceLocal, p.currency.length === 3 && p.currency !== 'GBp' ? p.currency : 'EUR')}
								{#if p.dayChangePct != null}<div class="text-xs {p.dayChangePct >= 0 ? 'pos' : 'neg'}">{pct(p.dayChangePct, 2)}</div>{/if}
							</td>
							<td class="hidden md:table-cell"><Sparkline values={p.spark ?? []} /></td>
							<td class="num text-right font-medium">{euro(p.valueEur)}</td>
							<td class="num text-right">
								{#if p.gainEur != null}
									<span class={p.gainEur >= 0 ? 'pos' : 'neg'}>{euro(p.gainEur)}</span>
									<div class="text-xs {p.gainEur >= 0 ? 'pos' : 'neg'} opacity-80">{pct(p.gainPct)}</div>
								{:else}<span class="text-white/30">—</span>{/if}
							</td>
							<td class="num text-right text-white/60">{(p.weight * 100).toFixed(1)}%</td>
							<td class="text-right">
								<button class="rounded-md p-1.5 text-white/40 hover:bg-white/5 hover:text-white" aria-label={p.hidden ? 'Tonen' : 'Verbergen'} title={p.hidden ? 'Meetellen' : 'Niet meetellen'} onclick={() => toggleHidden(p)}>
									<Icon name={p.hidden ? 'eyeoff' : 'eye'} />
								</button>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</section>
{:else}
	<section class="grid gap-6 lg:grid-cols-5">
		<div class="lg:col-span-3">
			<DropZone
				onfiles={handleFiles}
				title="Sleep je broker-export hierheen of klik om te kiezen"
				hint="CSV-bestanden van Trading 212, DEGIRO, Trade Republic, ING Zelf Beleggen en andere brokers. Onbekend formaat? Dan koppel je zelf de kolommen."
			/>
		</div>
		<div class="card lg:col-span-2">
			<h2 class="mb-3 font-semibold">Waar vind ik mijn export?</h2>
			<ul class="space-y-3 text-sm text-white/65">
				<li><b class="text-white">Trading 212</b> · Menu → Geschiedenis → Exporteren (CSV). Kies de hele periode sinds je eerste storting.</li>
				<li><b class="text-white">DEGIRO</b> · Inbox → Portefeuille → Exporteren (CSV), of Transacties → Exporteren.</li>
				<li><b class="text-white">Trade Republic</b> · Profiel → Transacties exporteren, of via de open-source tool <i>pytr</i> (Portfolio Performance-formaat).</li>
				<li><b class="text-white">ING Zelf Beleggen</b> · Mijn ING → Beleggen → Portefeuille → Exporteren (CSV).</li>
			</ul>
			<p class="mt-4 text-xs text-white/45">
				Eerst even proberen? Download een voorbeeld:
				<a class="underline" href="{base}/voorbeelden/trading212-geschiedenis.csv" download>Trading 212</a>,
				<a class="underline" href="{base}/voorbeelden/degiro-portfolio.csv" download>DEGIRO</a>,
				<a class="underline" href="{base}/voorbeelden/trade-republic-transacties.csv" download>Trade Republic</a>.
			</p>
		</div>
	</section>
{/if}

{#if pending && previewResult}
	<MappingDialog
		title="Portfolio importeren"
		fileName={pending.file}
		detected={pending.mapping.preset}
		confident={pending.confident}
		table={pending.table}
		fields={PF_FIELDS_BY_MODE[mode].map((k) => ({ key: k, label: PF_FIELD_LABELS[k] }))}
		bind:cols
		onconfirm={confirmImport}
		oncancel={() => (pending = null)}
	>
		{#snippet top()}
			<div class="mb-4 flex flex-wrap gap-2 text-sm">
				<span class="self-center text-white/60">Soort bestand:</span>
				<button class="btn {mode === 'transactions' ? 'btn-primary' : 'btn-ghost'} py-1.5" onclick={() => (mode = 'transactions')}>Transacties</button>
				<button class="btn {mode === 'snapshot' ? 'btn-primary' : 'btn-ghost'} py-1.5" onclick={() => (mode = 'snapshot')}>Huidige posities</button>
			</div>
		{/snippet}
		{#snippet summary()}
			<div class="rounded-lg border border-white/10 bg-white/[0.02] p-4">
				<div class="mb-2 text-sm font-medium">Voorbeeld: {previewResult.holdings.length} openstaande posities</div>
				<ul class="grid gap-1 text-sm sm:grid-cols-2">
					{#each previewResult.holdings.slice(0, 10) as h (h.key)}
						<li class="flex justify-between gap-2"><span class="truncate text-white/75">{h.name}</span><span class="num shrink-0 text-white/50">{qty(h.quantity)} st.{h.costEur ? ` · ${euro(h.costEur)}` : ''}</span></li>
					{/each}
				</ul>
				{#each previewResult.warnings as w (w)}<div class="mt-2 text-xs text-yellow-200/80">⚠ {w}</div>{/each}
			</div>
		{/snippet}
	</MappingDialog>
{/if}

{#if editing}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Koers koppelen">
		<div class="glass w-full max-w-lg p-6">
			<div class="mb-4 flex items-start justify-between">
				<div>
					<h2 class="font-semibold">{editing.name}</h2>
					<p class="text-xs text-white/45">Kies het beurssymbool voor live koersen, of vul zelf een koers in.</p>
				</div>
				<button class="rounded-md p-1.5 text-white/50 hover:text-white" aria-label="Sluiten" onclick={() => (editing = null)}><Icon name="x" /></button>
			</div>
			{#if prov !== 'none'}
				<form class="mb-3 flex gap-2" onsubmit={(e) => { e.preventDefault(); doSearch(); }}>
					<input class="input" bind:value={q} placeholder="ISIN, naam of ticker" />
					<button class="btn btn-ghost"><Icon name="search" /></button>
				</form>
				<ul class="mb-4 max-h-60 space-y-1 overflow-y-auto">
					{#each results as r (r.symbol)}
						<li>
							<button class="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-white/5" onclick={() => choose(r.symbol)}>
								<span class="w-24 shrink-0 font-mono text-purple-200">{r.symbol}</span>
								<span class="flex-1 truncate text-white/75">{r.name}</span>
								<span class="text-xs text-white/40">{r.exchange}</span>
							</button>
						</li>
					{:else}
						<li class="px-3 py-2 text-sm text-white/40">Geen resultaten.</li>
					{/each}
				</ul>
			{/if}
			<div class="border-t border-white/10 pt-4">
				<label class="label" for="mp">Handmatige koers (EUR per stuk)</label>
				<div class="mt-2 flex gap-2">
					<input id="mp" class="input" type="number" step="0.0001" bind:value={manual} />
					<button class="btn btn-primary" onclick={saveManual}>Opslaan</button>
				</div>
				{#if $holdingOverrides[editing.key]?.symbol}
					<button class="mt-3 text-xs text-white/50 underline" onclick={() => choose(null)}>Koppeling verwijderen</button>
				{/if}
			</div>
		</div>
	</div>
{/if}
