<script lang="ts">
	import ReportHeader from '$lib/components/ReportHeader.svelte';
	import MoneyField from '$lib/components/MoneyField.svelte';
	import TipList from '$lib/components/TipList.svelte';
	import Chart from '$lib/components/Chart.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import { doelenRapport } from '$lib/stores';
	import { berekenDoelen, emptyDoelen, plusMaanden, type DoelenData } from '$lib/reports/doelen';
	import { bekend } from '$lib/reports/prefill';
	import { autosave } from '$lib/reports/autosave';
	import { euro, compactEuro, uid } from '$lib/format';
	import { SERIES, INK } from '$lib/palette';

	const k = bekend();
	const start = (): DoelenData => ({ ...emptyDoelen(), maandUitgaven: k.uitgaven, vermogen: k.beleggingen, leeftijd: k.leeftijd, vrijeRuimte: k.vrijeRuimte, maandInleg: k.maandBeleggen });
	let d = $state<DoelenData>(structuredClone($doelenRapport.data ?? start()));
	const save = autosave(doelenRapport, () => $state.snapshot(d) as DoelenData, !!$doelenRapport.savedAt);
	$effect(() => {
		JSON.stringify(d);
		save();
	});
	const r = $derived(berekenDoelen(d));
	function reset() {
		if (confirm('Dit rapport leegmaken?')) {
			d = start();
			doelenRapport.set({ data: null, savedAt: null });
		}
	}
	const SUGGESTIES = ['Noodbuffer', 'Vakantie', 'Nieuwe auto', 'Eigen huis (eigen geld)', 'Bruiloft', 'Studie', 'Sabbatical', 'Verbouwing'];
	function add(naam = 'Nieuw doel') {
		d.doelen.push({ id: uid(), naam, bedrag: null, datum: plusMaanden(24), gespaard: 0 });
	}

	const chart = $derived({
		type: 'line',
		data: {
			labels: r.pad.map((p) => (d.leeftijd ? d.leeftijd + p.jaar : `+${p.jaar}`)),
			datasets: [
				{ label: 'Jouw vermogen', data: r.pad.map((p) => Math.round(p.vermogen)), borderColor: SERIES[0], backgroundColor: 'rgba(144,133,233,0.12)', fill: true, borderWidth: 2, pointRadius: 0, tension: 0.2 },
				{ label: 'FIRE-getal', data: r.pad.map((p) => Math.round(p.doel)), borderColor: SERIES[1], borderDash: [6, 4], borderWidth: 2, pointRadius: 0 }
			]
		},
		options: {
			maintainAspectRatio: false,
			interaction: { mode: 'index', intersect: false },
			scales: { x: { grid: { display: false }, title: { display: true, text: d.leeftijd ? 'Leeftijd' : 'Jaren', color: INK.muted } }, y: { grid: { color: INK.grid }, ticks: { callback: (v: any) => compactEuro(v) } } },
			plugins: { legend: { position: 'top', align: 'end' }, tooltip: { callbacks: { label: (c: any) => ` ${c.dataset.label}: ${euro(c.parsed.y)}` } } }
		}
	});
</script>

<svelte:head><title>Spaardoelen & FIRE · Lazul Finance</title></svelte:head>

<ReportHeader titel="Spaardoelen & financiële vrijheid" intro="Wat moet je per maand opzij zetten voor je doelen, en wanneer kun je stoppen met werken omdat je vermogen genoeg oplevert (FIRE)?" savedAt={$doelenRapport.savedAt} onreset={reset} />

<section class="glass mb-6 p-6">
	<div class="mb-4 flex flex-wrap items-center justify-between gap-3">
		<h2 class="font-semibold">Jouw spaardoelen</h2>
		<div class="flex flex-wrap gap-1.5">
			{#each SUGGESTIES.filter((s) => !d.doelen.some((x) => x.naam === s)) as s (s)}<button class="chip hover:border-purple-400/40" onclick={() => add(s)}>+ {s}</button>{/each}
		</div>
	</div>
	<div class="space-y-3">
		{#each d.doelen as doel, i (doel.id)}
			{@const res = r.doelen.find((x) => x.doel.id === doel.id)}
			<div class="grid items-end gap-3 rounded-lg border border-white/10 bg-white/[0.02] p-3 sm:grid-cols-[1.4fr_1fr_1fr_1fr_auto]">
				<label class="grid gap-1"><span class="text-xs text-white/50">Doel</span><input class="input h-9" bind:value={doel.naam} /></label>
				<label class="grid gap-1"><span class="text-xs text-white/50">Bedrag</span><input class="input h-9" type="number" min="0" bind:value={doel.bedrag} /></label>
				<label class="grid gap-1"><span class="text-xs text-white/50">Wanneer</span><input class="input h-9" type="month" bind:value={doel.datum} /></label>
				<label class="grid gap-1"><span class="text-xs text-white/50">Al gespaard</span><input class="input h-9" type="number" min="0" bind:value={doel.gespaard} /></label>
				<button class="mb-1 rounded-md p-2 text-white/40 hover:bg-red-950/40 hover:text-red-300" aria-label="Doel verwijderen" onclick={() => d.doelen.splice(i, 1)}><Icon name="trash" /></button>
				{#if res}
					<div class="flex flex-wrap items-center gap-3 text-sm sm:col-span-5">
						<div class="h-1.5 w-32 overflow-hidden rounded-full bg-white/10"><div class="h-full rounded-full bg-purple-400" style="width:{res.voortgang * 100}%"></div></div>
						<span class="num font-semibold text-purple-200">{euro(res.perMaand)} p/m</span>
						<span class="text-xs text-white/45">{res.maanden} maanden · {res.beleggen ? 'beleggen (≥ 5 jaar)' : 'sparen'}</span>
					</div>
				{/if}
			</div>
		{/each}
		<button class="btn btn-ghost" onclick={() => add()}><Icon name="plus" /> Doel toevoegen</button>
	</div>
	<div class="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg p-4 {r.pastInRuimte === false ? 'bg-orange-950/30 text-orange-100' : 'bg-white/[0.03]'}">
		<span class="text-sm">Totaal nodig: <b class="num text-lg">{euro(r.totaalPerMaand)}</b> per maand</span>
		{#if d.vrijeRuimte != null}<span class="text-sm text-white/60">Je houdt ± {euro(d.vrijeRuimte)} per maand over · {r.pastInRuimte ? '✓ past' : '✕ past niet'}</span>{/if}
	</div>
</section>

<div class="grid gap-6 lg:grid-cols-5">
	<section class="glass space-y-4 p-6 lg:col-span-2">
		<h2 class="font-semibold">FIRE: financieel onafhankelijk</h2>
		<p class="text-sm text-white/55">FIRE staat voor "Financial Independence, Retire Early": genoeg vermogen om van te leven door elk jaar een klein percentage op te nemen.</p>
		<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
			<MoneyField label="Uitgaven per maand" bind:value={d.maandUitgaven} />
			<MoneyField label="Huidig vermogen" suffix="€" bind:value={d.vermogen} />
			<MoneyField label="Beleggen per maand" bind:value={d.maandInleg} />
			<MoneyField label="Leeftijd" suffix="jaar" bind:value={d.leeftijd} />
			<MoneyField label="Opname per jaar" suffix="%" bind:value={d.opname} hint="4% is de bekende vuistregel; 3–3,5% is voorzichtiger." />
			<MoneyField label="Rendement na inflatie" suffix="%" bind:value={d.rendement} />
		</div>
	</section>
	<section class="card lg:col-span-3">
		<div class="mb-4 grid grid-cols-3 gap-3 text-center">
			<div class="rounded-lg bg-white/[0.03] p-3"><div class="text-xs text-white/45">FIRE-getal</div><div class="num text-lg font-semibold">{compactEuro(r.fireGetal)}</div></div>
			<div class="rounded-lg bg-white/[0.03] p-3"><div class="text-xs text-white/45">Vrij over</div><div class="num text-lg font-semibold text-purple-200">{r.jarenTotFire != null ? `${r.jarenTotFire} jaar` : '60+ jaar'}</div></div>
			<div class="rounded-lg bg-white/[0.03] p-3"><div class="text-xs text-white/45">Op leeftijd</div><div class="num text-lg font-semibold">{r.fireLeeftijd ?? '—'}</div></div>
		</div>
		<Chart height={260} config={chart} />
		<p class="mt-2 text-xs text-white/45">Coast FIRE: met {compactEuro(r.coastFire)} nu (zonder verdere inleg) haal je je FIRE-getal op je 67e. {r.isCoast ? 'Die heb je al!' : `Je zit op ${Math.round(((d.vermogen ?? 0) / Math.max(1, r.coastFire)) * 100)}%.`}</p>
	</section>
</div>

<section class="card mt-6">
	<h2 class="mb-4 font-semibold">Adviezen</h2>
	<TipList tips={r.tips} />
</section>
