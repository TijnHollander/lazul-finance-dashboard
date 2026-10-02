<script lang="ts">
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import DropZone from '$lib/components/DropZone.svelte';
	import MappingDialog from '$lib/components/MappingDialog.svelte';
	import Chart from '$lib/components/Chart.svelte';
	import Stat from '$lib/components/Stat.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import { readFileText, type CsvTable } from '$lib/parsers/csv';
	import { parseBankFile, buildBankTx, BANK_FIELD_LABELS, type BankMapping, type BankField } from '$lib/parsers/bank';
	import { CATEGORIES, categorize, ruleKey, summarize, FIXED, NEUTRAL, type Category } from '$lib/cashflow';
	import { bankTx, categoryRules, cashflowOptions, rapport, profile } from '$lib/stores';
	import { euro, pct, dateNl, monthLabel } from '$lib/format';
	import { SERIES, INK } from '$lib/palette';
	import { emptyRapport } from '$lib/report';

	let pending = $state<{ file: string; table: CsvTable; mapping: BankMapping; confident: boolean; queue: File[] } | null>(null);
	let cols = $state<Record<string, number | undefined>>({});
	let toast = $state<string | null>(null);

	async function handleFiles(files: File[]) {
		const [first, ...rest] = files;
		const p = parseBankFile(await readFileText(first));
		cols = { ...p.mapping.cols };
		pending = { file: first.name, table: p.table, mapping: p.mapping, confident: p.confident, queue: rest };
	}
	const preview = $derived(pending ? buildBankTx(pending.table, { ...pending.mapping, cols: cols as BankMapping['cols'] }) : null);

	function confirmImport() {
		if (!preview || !pending) return;
		const existing = new Set($bankTx.map((t) => t.id));
		const add = preview.tx.filter((t) => !existing.has(t.id));
		bankTx.update((l) => [...l, ...add].sort((a, b) => a.date.localeCompare(b.date)));
		show(`${add.length} transacties toegevoegd${preview.tx.length - add.length ? `, ${preview.tx.length - add.length} dubbele overgeslagen` : ''}.`);
		const q = pending.queue;
		pending = null;
		if (q.length) handleFiles(q);
	}
	function show(m: string) {
		toast = m;
		setTimeout(() => (toast = null), 4000);
	}

	// ── categoriseren
	const ownAccounts = $derived(new Set($bankTx.map((t) => t.account).filter(Boolean)));
	const cats = $derived(new Map($bankTx.map((t) => [t.id, categorize(t, ownAccounts, $categoryRules)] as const)));

	// ── periode
	const periodTx = $derived.by(() => {
		if (!$bankTx.length || !$cashflowOptions.months) return $bankTx;
		const last = $bankTx[$bankTx.length - 1].date;
		const d = new Date(last);
		d.setMonth(d.getMonth() - $cashflowOptions.months);
		const from = d.toISOString().slice(0, 7);
		return $bankTx.filter((t) => t.date.slice(0, 7) > from);
	});
	const s = $derived(summarize(periodTx, cats, $cashflowOptions.includePartial));

	// ── transactielijst
	let filterCat = $state<string>('');
	let search = $state('');
	let limit = $state(60);
	const list = $derived(
		[...periodTx]
			.reverse()
			.filter((t) => (!filterCat || cats.get(t.id) === filterCat) && (!search || `${t.counterparty} ${t.description}`.toLowerCase().includes(search.toLowerCase())))
	);

	function setCategory(t: (typeof $bankTx)[number], c: Category) {
		categoryRules.update((r) => ({ ...r, [ruleKey(t)]: c }));
		show(`Alle transacties van "${t.counterparty}" vallen nu onder ${c}.`);
	}

	function clearAll() {
		if (confirm('Alle geïmporteerde banktransacties verwijderen?')) {
			bankTx.set([]);
		}
	}

	/** Neemt de gemiddelden over in het rapport (gewogen gemiddelde per categorie). */
	function toRapport() {
		const by = (c: Category) => Math.round(s.categoryAvg.find((x) => x.category === c)?.avg ?? 0) || null;
		const inc = (c: Category) => Math.round(s.incomeAvg.find((x) => x.category === c)?.avg ?? 0) || null;
		const base0 = $rapport.data ?? emptyRapport($profile?.birthYear ?? null);
		rapport.set({
			...$rapport,
			data: {
				...base0,
				nettoInkomen: inc('Salaris & werk') ?? base0.nettoInkomen,
				toeslagen: inc('Uitkering & toeslagen') ?? base0.toeslagen,
				studiefinanciering: inc('Studiefinanciering') ?? base0.studiefinanciering,
				overigeInkomsten: inc('Overige inkomsten') ?? base0.overigeInkomsten,
				woonlasten: by('Wonen'),
				energieWater: by('Energie & water'),
				verzekeringen: by('Verzekeringen'),
				abonnementen: by('Telecom & abonnementen'),
				vervoer: by('Vervoer'),
				kinderopvangOverig: (by('Kinderen & onderwijs') ?? 0) + (by('Belastingen & overheid') ?? 0) || null,
				boodschappen: by('Boodschappen'),
				horeca: by('Uit eten & horeca'),
				winkelen: by('Winkelen'),
				vrijeTijd: by('Vrije tijd & reizen'),
				verzorging: by('Gezondheid & verzorging'),
				overigVariabel: (by('Overig') ?? 0) + (by('Contant geld') ?? 0) || null
			}
		});
		goto(`${base}/rapport/?stap=2`);
	}

	const monthsChart = $derived({
		type: 'bar',
		data: {
			labels: s.months.map((m) => monthLabel(m.key) + (m.partial ? '*' : '')),
			datasets: [
				{ label: 'Inkomsten', data: s.months.map((m) => Math.round(m.income)), backgroundColor: SERIES[2], borderRadius: 4, borderSkipped: 'start', maxBarThickness: 22 },
				{ label: 'Uitgaven', data: s.months.map((m) => Math.round(m.expenses)), backgroundColor: SERIES[1], borderRadius: 4, borderSkipped: 'start', maxBarThickness: 22 }
			]
		},
		options: {
			maintainAspectRatio: false,
			interaction: { mode: 'index', intersect: false },
			datasets: { bar: { categoryPercentage: 0.7, barPercentage: 0.9 } },
			scales: {
				x: { grid: { display: false } },
				y: { grid: { color: INK.grid }, ticks: { callback: (v: any) => euro(v) } }
			},
			plugins: {
				legend: { position: 'top', align: 'end' },
				tooltip: { callbacks: { label: (c: any) => ` ${c.dataset.label}: ${euro(c.parsed.y)}`, footer: (items: any[]) => `Netto: ${euro(items[0].parsed.y - (items[1]?.parsed.y ?? 0))}` } }
			}
		}
	});

	const topCats = $derived(s.categoryAvg.filter((c) => !NEUTRAL.includes(c.category)).slice(0, 10));
	const catChart = $derived({
		type: 'bar',
		data: {
			labels: topCats.map((c) => c.category),
			datasets: [{ label: 'Gemiddeld per maand', data: topCats.map((c) => Math.round(c.avg)), backgroundColor: topCats.map((c) => (FIXED.includes(c.category) ? SERIES[0] : '#5b5296')), borderRadius: 4, maxBarThickness: 18 }]
		},
		options: {
			indexAxis: 'y',
			maintainAspectRatio: false,
			scales: { x: { grid: { color: INK.grid }, ticks: { callback: (v: any) => euro(v) } }, y: { grid: { display: false }, ticks: { color: INK.primary } } },
			plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c: any) => ` ${euro(c.parsed.x)} per maand (${((topCats[c.dataIndex].share) * 100).toFixed(0)}% van je uitgaven)` } } }
		}
	});
</script>

<svelte:head><title>Uitgaven & inkomsten · Lazul Finance</title></svelte:head>

<header class="mb-8 flex flex-wrap items-end justify-between gap-4">
	<div>
		<h1 class="text-2xl font-bold tracking-tight sm:text-3xl">Uitgaven & inkomsten</h1>
		<p class="mt-1 text-sm text-white/50">Importeer je bankafschriften en zie wat er echt per maand in- en uitgaat.</p>
	</div>
	{#if $bankTx.length}
		<div class="flex flex-wrap items-center gap-2">
			<select class="input h-9 w-auto" bind:value={$cashflowOptions.months} aria-label="Periode">
				<option value={3}>Laatste 3 maanden</option>
				<option value={6}>Laatste 6 maanden</option>
				<option value={12}>Laatste 12 maanden</option>
				<option value={24}>Laatste 24 maanden</option>
				<option value={0}>Alles</option>
			</select>
			<button class="btn btn-primary" onclick={toRapport}><Icon name="report" /> Gebruik in rapport</button>
		</div>
	{/if}
</header>

{#if toast}<div class="mb-4 rounded-lg border border-purple-500/20 bg-purple-950/30 px-4 py-2 text-sm text-purple-200">{toast}</div>{/if}

{#if !$bankTx.length}
	<section class="grid gap-6 lg:grid-cols-5">
		<div class="lg:col-span-3">
			<DropZone onfiles={handleFiles} title="Sleep je bankexport hierheen" hint="CSV van ING, Rabobank, ABN AMRO (TAB), bunq, Revolut, SNS/ASN en meer. Exporteer bij voorkeur 6–12 maanden voor een betrouwbaar gemiddelde." accept=".csv,.tab,.txt" />
		</div>
		<div class="card lg:col-span-2">
			<h2 class="mb-3 font-semibold">Zo exporteer je</h2>
			<ul class="space-y-3 text-sm text-white/65">
				<li><b class="text-white">ING</b> · Mijn ING → Betaalrekening → Af- en bijschrijvingen downloaden → CSV (puntkomma).</li>
				<li><b class="text-white">Rabobank</b> · Rabo Internetbankieren → Transacties downloaden → CSV.</li>
				<li><b class="text-white">ABN AMRO</b> · Internet Bankieren → Af- en bijschrijvingen downloaden → TXT/TAB.</li>
				<li><b class="text-white">bunq / Revolut</b> · Rekening → Afschrift → CSV.</li>
			</ul>
			<p class="mt-4 text-xs text-white/45">Proberen? <a class="underline" href="{base}/voorbeelden/ing-betaalrekening.csv" download>Download een ING-voorbeeld</a>.</p>
		</div>
	</section>
{:else}
	<section class="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
		<Stat label="Inkomsten per maand" value={euro(s.wAvgIncome)} sub={`gewogen · gemiddeld ${euro(s.avgIncome)} · mediaan ${euro(s.medIncome)}`} tone="pos" />
		<Stat label="Uitgaven per maand" value={euro(s.wAvgExpenses)} sub={`gewogen · gemiddeld ${euro(s.avgExpenses)} · mediaan ${euro(s.medExpenses)}`} />
		<Stat label="Over per maand" value={euro(s.wAvgIncome - s.wAvgExpenses)} sub={`spaarquote ${pct(s.savingsRate * 100, 0, false)} van je inkomen`} tone={s.wAvgIncome - s.wAvgExpenses >= 0 ? 'pos' : 'neg'} />
		<Stat label="Naar sparen & beleggen" value={euro(s.avgSaved)} sub="gemiddeld per maand overgemaakt" tone="brand" />
	</section>

	<p class="mb-6 flex items-start gap-2 text-xs text-white/45">
		<Icon name="info" class="mt-0.5 size-3.5 shrink-0" />
		<span>
			Het <b class="text-white/70">gewogen gemiddelde</b> laat recente maanden zwaarder meetellen (laatste maand × {s.used.length}, eerste × 1), zodat een loonsverhoging of nieuwe huur direct doorwerkt. Gebaseerd op {s.used.length} volledige maanden ({s.firstDate ? dateNl(s.firstDate) : ''} – {s.lastDate ? dateNl(s.lastDate) : ''}). Overboekingen naar je eigen spaar- en beleggingsrekeningen tellen niet als uitgave.
			{#if s.months.some((m) => m.partial)}Maanden met * zijn onvolledig en tellen {$cashflowOptions.includePartial ? 'wél' : 'niet'} mee
				(<button class="underline" onclick={() => ($cashflowOptions.includePartial = !$cashflowOptions.includePartial)}>wijzig</button>).{/if}
		</span>
	</p>

	<section class="mb-6 grid gap-4 lg:grid-cols-5">
		<div class="card lg:col-span-3">
			<h2 class="card-title mb-3">Per maand</h2>
			<Chart height={280} config={monthsChart} />
		</div>
		<div class="card lg:col-span-2">
			<div class="mb-3 flex items-center justify-between">
				<h2 class="card-title">Waar gaat het heen?</h2>
				<div class="flex gap-3 text-xs text-white/55">
					<span class="flex items-center gap-1.5"><span class="size-2.5 rounded-sm" style="background:{SERIES[0]}"></span>vast</span>
					<span class="flex items-center gap-1.5"><span class="size-2.5 rounded-sm" style="background:#5b5296"></span>variabel</span>
				</div>
			</div>
			<Chart height={280} config={catChart} />
			<div class="mt-3 grid grid-cols-2 gap-2 text-sm">
				<div class="rounded-lg bg-white/[0.03] px-3 py-2"><div class="text-xs text-white/45">Vaste lasten</div><div class="num font-medium">{euro(s.avgFixed)}</div></div>
				<div class="rounded-lg bg-white/[0.03] px-3 py-2"><div class="text-xs text-white/45">Variabel</div><div class="num font-medium">{euro(s.avgVariable)}</div></div>
			</div>
		</div>
	</section>

	<section class="card p-0">
		<div class="flex flex-wrap items-center gap-2 border-b border-white/10 p-4">
			<h2 class="mr-auto font-semibold">Transacties</h2>
			<div class="relative">
				<input class="input h-9 w-56 pl-8" placeholder="Zoeken…" bind:value={search} />
				<Icon name="search" class="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-white/40" />
			</div>
			<select class="input h-9 w-auto" bind:value={filterCat} aria-label="Categorie">
				<option value="">Alle categorieën</option>
				{#each CATEGORIES as c (c)}<option value={c}>{c}</option>{/each}
			</select>
			<details class="relative">
				<summary class="btn btn-ghost h-9 list-none py-0"><Icon name="plus" /> Import</summary>
				<div class="absolute right-0 z-10 mt-2 w-80 rounded-xl border border-white/10 bg-black p-3 shadow-2xl">
					<DropZone onfiles={handleFiles} title="Bankexport toevoegen" hint="Dubbele transacties worden automatisch overgeslagen." />
					<button class="btn btn-danger mt-3 w-full" onclick={clearAll}><Icon name="trash" /> Alle transacties wissen</button>
				</div>
			</details>
		</div>
		<div class="overflow-x-auto">
			<table class="table">
				<thead><tr><th>Datum</th><th>Omschrijving</th><th>Categorie</th><th class="text-right">Bedrag</th></tr></thead>
				<tbody>
					{#each list.slice(0, limit) as t (t.id)}
						{@const c = cats.get(t.id)}
						<tr>
							<td class="whitespace-nowrap text-white/55">{dateNl(t.date)}</td>
							<td class="max-w-md">
								<div class="truncate text-white/90">{t.counterparty}</div>
								{#if t.description && t.description !== t.counterparty}<div class="truncate text-xs text-white/40">{t.description}</div>{/if}
							</td>
							<td>
								<select
									class="h-8 cursor-pointer rounded-md border border-white/10 bg-transparent px-2 text-xs text-white/75 outline-none hover:border-purple-500/40"
									value={c}
									onchange={(e) => setCategory(t, (e.target as HTMLSelectElement).value as Category)}
									aria-label="Categorie"
								>
									{#each CATEGORIES as cc (cc)}<option value={cc} class="bg-black">{cc}</option>{/each}
								</select>
							</td>
							<td class="num text-right whitespace-nowrap {t.amount >= 0 ? 'pos' : 'text-white/85'} {c && NEUTRAL.includes(c) ? 'opacity-50' : ''}">{t.amount >= 0 ? '+' : ''}{euro(t.amount, true)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		{#if list.length > limit}
			<div class="p-4 text-center"><button class="btn btn-ghost" onclick={() => (limit += 100)}>Meer tonen ({list.length - limit} over)</button></div>
		{/if}
	</section>
{/if}

{#if pending && preview}
	<MappingDialog
		title="Bankafschrift importeren"
		fileName={pending.file}
		detected={pending.mapping.preset}
		confident={pending.confident}
		table={pending.table}
		fields={(Object.keys(BANK_FIELD_LABELS) as BankField[]).map((k) => ({ key: k, label: BANK_FIELD_LABELS[k] }))}
		bind:cols
		onconfirm={confirmImport}
		oncancel={() => (pending = null)}
	>
		{#snippet summary()}
			<div class="rounded-lg border border-white/10 bg-white/[0.02] p-4 text-sm">
				<div class="mb-2 font-medium">{preview.tx.length} transacties gevonden{preview.skipped ? ` · ${preview.skipped} regels overgeslagen` : ''}</div>
				<ul class="space-y-1">
					{#each preview.tx.slice(0, 6) as t (t.id)}
						<li class="flex justify-between gap-3"><span class="truncate text-white/70">{t.date} · {t.counterparty}</span><span class="num {t.amount >= 0 ? 'pos' : ''}">{euro(t.amount, true)}</span></li>
					{/each}
				</ul>
			</div>
		{/snippet}
	</MappingDialog>
{/if}
