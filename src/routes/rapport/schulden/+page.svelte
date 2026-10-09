<script lang="ts">
	import ReportHeader from '$lib/components/ReportHeader.svelte';
	import MoneyField from '$lib/components/MoneyField.svelte';
	import TipList from '$lib/components/TipList.svelte';
	import Chart from '$lib/components/Chart.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import { schuldenRapport } from '$lib/stores';
	import { berekenSchulden, emptySchulden, geschatteTermijn, SOORT_LABEL, SOORT_RENTE, type SchuldenData, type Schuld } from '$lib/reports/schulden';
	import { bekend } from '$lib/reports/prefill';
	import { autosave } from '$lib/reports/autosave';
	import { euro, compactEuro, uid } from '$lib/format';
	import { SERIES, INK } from '$lib/palette';

	const k = bekend();
	const start = (): SchuldenData => {
		const e = emptySchulden();
		if (k.studieschuld) e.schulden.push({ id: uid(), naam: 'Studieschuld', soort: 'duo', saldo: k.studieschuld, rente: SOORT_RENTE.duo, termijn: null });
		if (k.overigeSchulden) e.schulden.push({ id: uid(), naam: 'Overige schuld', soort: 'persoonlijk', saldo: k.overigeSchulden, rente: SOORT_RENTE.persoonlijk, termijn: null });
		return e;
	};
	let d = $state<SchuldenData>(structuredClone($schuldenRapport.data ?? start()));
	const save = autosave(schuldenRapport, () => $state.snapshot(d) as SchuldenData, !!$schuldenRapport.savedAt);
	$effect(() => {
		JSON.stringify(d);
		save();
	});
	const r = $derived(berekenSchulden(d));
	function reset() {
		if (confirm('Dit rapport leegmaken?')) {
			d = start();
			schuldenRapport.set({ data: null, savedAt: null });
		}
	}
	function add(soort: Schuld['soort'] = 'creditcard') {
		d.schulden.push({ id: uid(), naam: SOORT_LABEL[soort], soort, saldo: null, rente: SOORT_RENTE[soort], termijn: null });
	}
	let methode = $state<'lawine' | 'sneeuwbal'>('lawine');
	const gekozen = $derived(methode === 'lawine' ? r.lawine : r.sneeuwbal);
	const lengte = $derived(Math.max(r.minimum.verloop.length, gekozen.verloop.length));
	const stap = $derived(Math.max(1, Math.ceil(lengte / 60)));
	const idx = $derived(Array.from({ length: Math.ceil(lengte / stap) }, (_, i) => i * stap));
	const chart = $derived({
		type: 'line',
		data: {
			labels: idx.map((i) => (i % 12 === 0 ? `${i / 12} jr` : `${i} mnd`)),
			datasets: [
				{ label: `${gekozen.naam} + extra`, data: idx.map((i) => Math.round(gekozen.verloop[i] ?? 0)), borderColor: SERIES[0], backgroundColor: 'rgba(144,133,233,0.12)', fill: true, borderWidth: 2, pointRadius: 0, tension: 0.15 },
				{ label: 'Alleen minimum', data: idx.map((i) => Math.round(r.minimum.verloop[i] ?? 0)), borderColor: SERIES[1], borderWidth: 2, pointRadius: 0, borderDash: [6, 4], tension: 0.15 }
			]
		},
		options: {
			maintainAspectRatio: false,
			interaction: { mode: 'index', intersect: false },
			scales: { x: { grid: { display: false }, ticks: { maxTicksLimit: 8, maxRotation: 0 } }, y: { grid: { color: INK.grid }, ticks: { callback: (v: any) => compactEuro(v) } } },
			plugins: { legend: { position: 'top', align: 'end' }, tooltip: { callbacks: { label: (c: any) => ` ${c.dataset.label}: ${euro(c.parsed.y)} schuld` } } }
		}
	});
	const jm = (m: number | null) => (m == null ? 'nooit' : m < 12 ? `${m} mnd` : `${Math.floor(m / 12)} jr ${m % 12 ? `${m % 12} mnd` : ''}`);
</script>

<svelte:head><title>Schulden aflossen · Lazul Finance</title></svelte:head>

<ReportHeader titel="Schulden aflossen" intro="Zet je schulden op een rij en zie hoe snel je schuldenvrij bent met een slim aflosplan: lawine (hoogste rente eerst) of sneeuwbal (kleinste eerst)." savedAt={$schuldenRapport.savedAt} onreset={reset} />

<section class="glass mb-6 p-6">
	<div class="mb-4 flex flex-wrap items-center justify-between gap-3">
		<h2 class="font-semibold">Je schulden</h2>
		<div class="flex flex-wrap gap-1.5">
			{#each Object.entries(SOORT_LABEL) as [s, l] (s)}<button class="chip hover:border-purple-400/40" onclick={() => add(s as Schuld['soort'])}>+ {l}</button>{/each}
		</div>
	</div>
	<div class="space-y-3">
		{#each d.schulden as s, i (s.id)}
			<div class="grid items-end gap-3 rounded-lg border border-white/10 bg-white/[0.02] p-3 sm:grid-cols-[1.4fr_1fr_0.8fr_1fr_auto]">
				<label class="grid gap-1"><span class="text-xs text-white/50">{SOORT_LABEL[s.soort]}</span><input class="input h-9" bind:value={s.naam} /></label>
				<label class="grid gap-1"><span class="text-xs text-white/50">Openstaand</span><input class="input h-9" type="number" min="0" bind:value={s.saldo} /></label>
				<label class="grid gap-1"><span class="text-xs text-white/50">Rente %</span><input class="input h-9" type="number" min="0" max="30" step="0.1" bind:value={s.rente} /></label>
				<label class="grid gap-1"><span class="text-xs text-white/50">Min. per maand</span><input class="input h-9" type="number" min="0" placeholder={s.saldo ? `± ${Math.round(geschatteTermijn(s))} (schatting)` : ''} bind:value={s.termijn} /></label>
				<button class="mb-1 rounded-md p-2 text-white/40 hover:bg-red-950/40 hover:text-red-300" aria-label="Verwijderen" onclick={() => d.schulden.splice(i, 1)}><Icon name="trash" /></button>
			</div>
		{:else}
			<p class="text-sm text-white/45">Nog geen schulden toegevoegd. Klik hierboven op een soort schuld. Geen schulden? Dan ben je al klaar.</p>
		{/each}
	</div>
	<div class="mt-5 max-w-sm"><MoneyField label="Extra aflossen per maand" bind:value={d.extra} hint="Bovenop alle minimale termijnen." /></div>
</section>

{#if r.totaal > 0}
	<div class="grid gap-6 lg:grid-cols-5">
		<section class="card lg:col-span-3">
			<div class="mb-4 flex flex-wrap items-center justify-between gap-3">
				<h2 class="font-semibold">Wanneer ben je schuldenvrij?</h2>
				<div class="flex gap-1 rounded-lg border border-white/10 p-1">
					<button class="rounded-md px-3 py-1 text-xs {methode === 'lawine' ? 'bg-purple-950/60 text-purple-200' : 'text-white/55'}" onclick={() => (methode = 'lawine')}>Lawine</button>
					<button class="rounded-md px-3 py-1 text-xs {methode === 'sneeuwbal' ? 'bg-purple-950/60 text-purple-200' : 'text-white/55'}" onclick={() => (methode = 'sneeuwbal')}>Sneeuwbal</button>
				</div>
			</div>
			<Chart height={260} config={chart} />
			<p class="mt-2 text-xs text-white/45">Aflosvolgorde: {gekozen.volgorde.join(' → ') || '—'}{d.schulden.some((x) => x.soort === 'duo') ? ' (studieschuld loopt apart door)' : ''}</p>
		</section>
		<aside class="space-y-3 lg:col-span-2">
			<div class="card grid grid-cols-2 gap-4 text-sm">
				<div><div class="text-xs text-white/45">Totale schuld</div><div class="num text-lg font-semibold">{euro(r.totaal)}</div></div>
				<div><div class="text-xs text-white/45">Gemiddelde rente</div><div class="num text-lg font-semibold">{r.gemRente.toFixed(1).replace('.', ',')}%</div></div>
			</div>
			{#each [r.lawine, r.sneeuwbal, r.minimum] as sc (sc.naam)}
				<div class="flex items-center justify-between rounded-lg border px-4 py-3 text-sm {sc === gekozen ? 'border-purple-500/40 bg-purple-950/30' : 'border-white/10 bg-white/[0.02]'}">
					<span class="text-white/80">{sc.naam}</span>
					<span class="text-right"><span class="num block font-semibold">{jm(sc.maanden)}</span><span class="num text-xs text-white/45">{euro(sc.totaleRente)} rente</span></span>
				</div>
			{/each}
			{#if r.besparing > 0}<div class="rounded-lg border border-emerald-500/30 bg-emerald-950/20 px-4 py-3 text-sm text-emerald-200">Met {euro(d.extra ?? 0)} extra per maand bespaar je <b class="num">{euro(r.besparing)}</b> aan rente.</div>{/if}
		</aside>
	</div>
{/if}

<section class="card mt-6">
	<h2 class="mb-4 font-semibold">Adviezen</h2>
	<TipList tips={r.tips} />
</section>
