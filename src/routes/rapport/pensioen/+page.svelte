<script lang="ts">
	import ReportHeader from '$lib/components/ReportHeader.svelte';
	import MoneyField from '$lib/components/MoneyField.svelte';
	import Toggle from '$lib/components/Toggle.svelte';
	import TipList from '$lib/components/TipList.svelte';
	import Chart from '$lib/components/Chart.svelte';
	import { pensioenRapport } from '$lib/stores';
	import { berekenPensioen, emptyPensioen, type PensioenData } from '$lib/reports/pensioen';
	import { bekend } from '$lib/reports/prefill';
	import { autosave } from '$lib/reports/autosave';
	import { euro, compactEuro } from '$lib/format';
	import { SERIES, INK } from '$lib/palette';

	const k = bekend();
	const start = (): PensioenData => ({ ...emptyPensioen(k.leeftijd, k.netto), samenwonend: k.samenwonend, eigenVermogen: null });
	let d = $state<PensioenData>(structuredClone($pensioenRapport.data ?? start()));
	const save = autosave(pensioenRapport, () => $state.snapshot(d) as PensioenData, !!$pensioenRapport.savedAt);
	$effect(() => {
		JSON.stringify(d);
		save();
	});
	const r = $derived(berekenPensioen(d));
	function reset() {
		if (confirm('Dit rapport leegmaken?')) {
			d = start();
			pensioenRapport.set({ data: null, savedAt: null });
		}
	}

	// gestapelde staaf: waar komt je pensioeninkomen vandaan
	const bronnen = $derived([
		{ label: 'AOW', v: r.aow, c: SERIES[5] },
		{ label: 'Werkgeverspensioen', v: r.pensioenNetto, c: SERIES[2] },
		{ label: 'Gat (zelf aanvullen)', v: r.gat, c: SERIES[1] }
	]);
	const chart = $derived({
		type: 'line',
		data: {
			labels: r.opbouw.map((o) => o.leeftijd),
			datasets: [
				{ label: 'Met extra inleg (doel)', data: r.opbouw.map((o) => Math.round(o.nodig)), borderColor: SERIES[0], backgroundColor: 'rgba(144,133,233,0.12)', fill: true, borderWidth: 2, pointRadius: 0, tension: 0.2 },
				{ label: 'Huidig tempo', data: r.opbouw.map((o) => Math.round(o.nu)), borderColor: SERIES[1], borderWidth: 2, pointRadius: 0, tension: 0.2 }
			]
		},
		options: {
			maintainAspectRatio: false,
			interaction: { mode: 'index', intersect: false },
			scales: { x: { grid: { display: false }, title: { display: true, text: 'Leeftijd', color: INK.muted } }, y: { grid: { color: INK.grid }, ticks: { callback: (v: any) => compactEuro(v) } } },
			plugins: { legend: { position: 'top', align: 'end' }, tooltip: { callbacks: { title: (i: any[]) => `${i[0].label} jaar`, label: (c: any) => ` ${c.dataset.label}: ${euro(c.parsed.y)}` } } }
		}
	});
</script>

<svelte:head><title>Pensioen · Lazul Finance</title></svelte:head>

<ReportHeader titel="Pensioen & AOW-gat" intro="Heb je straks genoeg om van te leven? Je AOW, je opgebouwde pensioen en wat je zelf moet aanvullen, in euro's van nu." savedAt={$pensioenRapport.savedAt} onreset={reset} />

<div class="grid gap-6 lg:grid-cols-5">
	<div class="glass space-y-6 p-6 lg:col-span-3">
		<section class="grid gap-4 sm:grid-cols-2">
			<h2 class="font-semibold sm:col-span-2">Nu</h2>
			<MoneyField label="Leeftijd" suffix="jaar" bind:value={d.leeftijd} />
			<MoneyField label="Netto inkomen per maand" bind:value={d.nettoInkomen} />
			<MoneyField label="Bruto jaarinkomen" suffix="€ / jaar" bind:value={d.brutoJaar} hint="Voor het belastingvoordeel van lijfrente." />
			<div class="self-end"><Toggle label="Ik woon samen / ben getrouwd" hint="Bepaalt de hoogte van je AOW." bind:checked={d.samenwonend} /></div>
		</section>

		<section class="grid gap-4 sm:grid-cols-2">
			<h2 class="font-semibold sm:col-span-2">Wat je al opbouwt</h2>
			<MoneyField label="Verwacht werkgeverspensioen" suffix="€ bruto / jaar" bind:value={d.verwachtPensioen} hint="Staat op mijnpensioenoverzicht.nl, zonder AOW." />
			<MoneyField label="Eigen pensioenpotje" suffix="€" bind:value={d.eigenVermogen} hint="Lijfrente, banksparen of beleggingen voor later." />
			<MoneyField label="Wat je nu zelf per maand inlegt" bind:value={d.maandInleg} />
		</section>

		<section class="grid gap-5">
			<h2 class="font-semibold">Je wensen</h2>
			<label class="grid gap-2">
				<span class="text-sm text-white/75">Inkomen na pensioen: <b class="num text-purple-200">{d.doelPercentage}%</b> van nu ({euro(r.doelNetto)} netto p/m)</span>
				<input type="range" min="50" max="100" step="5" bind:value={d.doelPercentage} class="accent-purple-400" />
				<span class="hint">70% is een veelgebruikte vuistregel: geen hypotheek, minder werkkosten.</span>
			</label>
			<label class="grid gap-2">
				<span class="text-sm text-white/75">Stoppen met werken op <b class="num text-purple-200">{d.stopLeeftijd}</b> jaar <span class="text-white/40">(AOW vanaf {d.aowLeeftijd})</span></span>
				<input type="range" min="50" max={d.aowLeeftijd} step="1" bind:value={d.stopLeeftijd} class="accent-purple-400" />
			</label>
			<div class="grid gap-4 sm:grid-cols-2">
				<MoneyField label="AOW-leeftijd" suffix="jaar" bind:value={d.aowLeeftijd} />
				<MoneyField label="Rendement na inflatie" suffix="%" bind:value={d.rendement} hint="3–4% is realistisch voor een gespreide portefeuille." />
			</div>
		</section>
	</div>

	<aside class="space-y-4 lg:sticky lg:top-16 lg:col-span-2 lg:self-start">
		<div class="rounded-xl border p-5 {r.maandNodig > 0 ? 'border-orange-500/30 bg-orange-950/20' : 'border-emerald-500/30 bg-emerald-950/20'}">
			<div class="text-xs opacity-80">{r.maandNodig > 0 ? 'Extra opzij zetten per maand' : 'Je pensioen is op koers'}</div>
			<div class="num mt-1 text-3xl font-bold">{r.maandNodig > 0 ? euro(r.maandNodig) : '✓'}</div>
			<div class="mt-1 text-sm opacity-80">{r.maandNodig > 0 ? `nog ${r.jarenTotStop} jaar tot je ${d.stopLeeftijd}e · benodigd kapitaal ${euro(r.benodigdKapitaal)}` : `Verwacht kapitaal ${euro(r.kapitaalStraks)} dekt je wens`}</div>
		</div>
		<div class="card">
			<div class="mb-3 text-sm font-medium">Je inkomen na pensioen (netto p/m)</div>
			<div class="flex h-3 overflow-hidden rounded-full bg-white/10" aria-hidden="true">
				{#each bronnen as b (b.label)}<div style="width:{(b.v / Math.max(1, r.doelNetto, r.aow + r.pensioenNetto)) * 100}%;background:{b.c}" class="border-r-2 border-black last:border-0"></div>{/each}
			</div>
			<ul class="mt-3 space-y-1.5 text-sm">
				{#each bronnen as b (b.label)}
					<li class="flex items-center gap-2"><span class="size-2.5 rounded-sm" style="background:{b.c}"></span><span class="flex-1 text-white/70">{b.label}</span><span class="num">{euro(b.v)}</span></li>
				{/each}
				<li class="flex justify-between border-t border-white/10 pt-1.5 font-medium"><span>Doel</span><span class="num">{euro(r.doelNetto)}</span></li>
			</ul>
		</div>
	</aside>
</div>

<div class="mt-6 grid gap-6 lg:grid-cols-5">
	<section class="card lg:col-span-3">
		<h2 class="mb-4 font-semibold">Adviezen</h2>
		<TipList tips={r.tips} />
	</section>
	<section class="card lg:col-span-2">
		<h2 class="mb-1 font-semibold">Je pensioenpotje tot je {d.stopLeeftijd}e</h2>
		<p class="mb-3 text-xs text-white/45">In euro's van nu, bij {d.rendement.toLocaleString('nl-NL')}% rendement na inflatie.</p>
		<Chart height={240} config={chart} />
	</section>
</div>
<p class="mt-6 text-xs text-white/35">Netto AOW per juli 2026 ({euro(r.aow)} p/m). Werkgeverspensioen omgerekend naar netto met ± 22% belasting. Een grove indicatie: gebruik mijnpensioenoverzicht.nl voor je eigen cijfers.</p>
