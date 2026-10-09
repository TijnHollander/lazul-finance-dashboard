<script lang="ts">
	import ReportHeader from '$lib/components/ReportHeader.svelte';
	import MoneyField from '$lib/components/MoneyField.svelte';
	import Choice from '$lib/components/Choice.svelte';
	import TipList from '$lib/components/TipList.svelte';
	import Chart from '$lib/components/Chart.svelte';
	import { hypotheekRapport } from '$lib/stores';
	import { berekenHypotheek, emptyHypotheek, type HypotheekData } from '$lib/reports/hypotheek';
	import { bekend } from '$lib/reports/prefill';
	import { autosave } from '$lib/reports/autosave';
	import { euro, compactEuro } from '$lib/format';
	import { SERIES, INK } from '$lib/palette';

	const k = bekend();
	const start = (): HypotheekData => {
		const e = emptyHypotheek(k.leeftijd, null);
		if (k.woonsituatie === 'koop') {
			e.situatie = 'oversluiten';
			e.woningprijs = k.woningwaarde;
			e.huidigSaldo = k.hypotheek;
		}
		e.eigenGeld = k.spaargeld;
		return e;
	};
	let d = $state<HypotheekData>(structuredClone($hypotheekRapport.data ?? start()));
	const save = autosave(hypotheekRapport, () => $state.snapshot(d) as HypotheekData, !!$hypotheekRapport.savedAt);
	$effect(() => {
		JSON.stringify(d);
		save();
	});
	const r = $derived(berekenHypotheek(d));
	const kleur = $derived(r.oordeel === 'groen' ? 'text-emerald-300 border-emerald-500/30 bg-emerald-950/20' : r.oordeel === 'oranje' ? 'text-yellow-100 border-yellow-500/30 bg-yellow-950/20' : 'text-red-200 border-red-500/30 bg-red-950/20');

	function reset() {
		if (confirm('Dit rapport leegmaken?')) {
			d = start();
			hypotheekRapport.set({ data: null, savedAt: null });
		}
	}

	const chart = $derived({
		type: 'line',
		data: {
			labels: r.verloop.map((v) => v.jaar),
			datasets: [
				{ label: 'Annuïtair', data: r.verloop.map((v) => Math.round(v.schuldAnnuitair)), borderColor: SERIES[0], borderWidth: 2, pointRadius: 0, tension: 0.2 },
				{ label: 'Lineair', data: r.verloop.map((v) => Math.round(v.schuldLineair)), borderColor: SERIES[2], borderWidth: 2, pointRadius: 0, borderDash: [5, 4] }
			]
		},
		options: {
			maintainAspectRatio: false,
			interaction: { mode: 'index', intersect: false },
			scales: { x: { grid: { display: false }, title: { display: true, text: 'Jaar', color: INK.muted } }, y: { grid: { color: INK.grid }, ticks: { callback: (v: any) => compactEuro(v) } } },
			plugins: { legend: { position: 'top', align: 'end' }, tooltip: { callbacks: { title: (i: any[]) => `Na ${i[0].label} jaar`, label: (c: any) => ` ${c.dataset.label}: ${euro(c.parsed.y)} restschuld` } } }
		}
	});
</script>

<svelte:head><title>Hypotheek & koophuis · Lazul Finance</title></svelte:head>

<ReportHeader titel="Hypotheek & koophuis" intro="Hoeveel kun je lenen, wat kost een huis per maand en loont oversluiten? Met de normen van 2026 (Nibud-woonquote, NHG-grens € 470.000, startersvrijstelling tot € 555.000)." savedAt={$hypotheekRapport.savedAt} onreset={reset} />

<div class="grid gap-6 lg:grid-cols-5">
	<div class="glass space-y-6 p-6 lg:col-span-3">
		<section class="grid gap-3">
			<h2 class="font-semibold">Situatie</h2>
			<Choice options={[['eerste_koop', 'Eerste huis'], ['doorstromer', 'Ik verhuis (doorstromer)'], ['oversluiten', 'Hypotheek oversluiten']]} bind:value={d.situatie} />
		</section>

		<section class="grid gap-4 sm:grid-cols-2">
			<h2 class="font-semibold sm:col-span-2">Inkomen & verplichtingen</h2>
			<MoneyField label="Jouw bruto jaarinkomen" suffix="€ / jaar" bind:value={d.brutoInkomen} hint="Inclusief vakantiegeld en vaste 13e maand." />
			<MoneyField label="Bruto jaarinkomen partner" suffix="€ / jaar" bind:value={d.partnerInkomen} />
			<MoneyField label="Leeftijd" suffix="jaar" bind:value={d.leeftijd} hint="Startersvrijstelling tot 35 jaar." />
			<MoneyField label="DUO-termijn studieschuld" bind:value={d.duoTermijn} hint="Zie Mijn DUO; ook als je nu (nog) niet aflost." />
			<MoneyField label="Andere leningen (maandlast)" bind:value={d.andereLeningen} hint="Persoonlijke lening, private lease, creditcard." />
		</section>

		{#if d.situatie !== 'oversluiten'}
			<section class="grid gap-4 sm:grid-cols-2">
				<h2 class="font-semibold sm:col-span-2">De woning</h2>
				<MoneyField label="Koopprijs" suffix="€" bind:value={d.woningprijs} />
				<MoneyField label="Eigen geld (spaargeld, schenking)" suffix="€" bind:value={d.eigenGeld} hint="Gaat eerst naar de kosten koper." />
				{#if d.situatie === 'doorstromer'}<MoneyField label="Overwaarde huidige woning" suffix="€" bind:value={d.overwaarde} hint="Verkoopprijs min restschuld en verkoopkosten." />{/if}
				<MoneyField label="Budget voor verduurzaming" suffix="€" bind:value={d.energieBesparend} hint="Isolatie, warmtepomp, zonnepanelen." />
			</section>
		{:else}
			<section class="grid gap-4 sm:grid-cols-2">
				<h2 class="font-semibold sm:col-span-2">Je huidige hypotheek</h2>
				<MoneyField label="Openstaande schuld" suffix="€" bind:value={d.huidigSaldo} />
				<MoneyField label="Huidige rente" suffix="%" bind:value={d.huidigeRente} />
				<MoneyField label="Resterende looptijd" suffix="jaar" bind:value={d.restlooptijd} />
				<MoneyField label="Boeterente (opvragen bij bank)" suffix="€" bind:value={d.boeterente} />
				<MoneyField label="Woningwaarde (WOZ/taxatie)" suffix="€" bind:value={d.woningprijs} />
			</section>
		{/if}

		<section class="grid gap-4">
			<h2 class="font-semibold">Rente</h2>
			<div class="grid gap-4 sm:grid-cols-2">
				<MoneyField label="Verwachte hypotheekrente" suffix="%" bind:value={d.rente} hint="Check actuele tarieven bij een vergelijker; NHG is vaak goedkoper." />
				<div class="grid gap-1.5">
					<span class="label">Rentevaste periode</span>
					<Choice size="sm" options={[[5, '5 jr'], [10, '10 jr'], [20, '20 jr'], [30, '30 jr']]} bind:value={d.rentevast} />
				</div>
			</div>
		</section>
	</div>

	<aside class="space-y-4 lg:sticky lg:top-16 lg:col-span-2 lg:self-start">
		<div class="rounded-xl border p-5 {kleur}">
			{#if d.situatie === 'oversluiten'}
				<div class="text-xs opacity-80">Oversluiten</div>
				{#if r.oversluiten}
					<div class="num mt-1 text-2xl font-bold">{r.oversluiten.besparing > 0 ? `${euro(r.oversluiten.besparing)} p/m minder` : 'Geen besparing'}</div>
					<div class="mt-1 text-sm opacity-80">{r.oversluiten.terugverdienMaanden ? `Kosten ${euro(r.oversluiten.kosten)} terugverdiend in ± ${r.oversluiten.terugverdienMaanden} maanden` : 'Vul je huidige rente en schuld in'}</div>
				{:else}<div class="mt-1 text-sm">Vul je huidige hypotheek in.</div>{/if}
			{:else}
				<div class="text-xs opacity-80">Maximale hypotheek (indicatie)</div>
				<div class="num mt-1 text-3xl font-bold">{euro(r.maxHypotheek)}</div>
				<div class="mt-1 text-sm opacity-80">Toetsrente {r.toetsrente.toLocaleString('nl-NL')}% · woonquote {(r.woonquote * 100).toFixed(1).replace('.', ',')}% · max. {euro(r.maxMaandlast)} bruto p/m</div>
				{#if d.woningprijs}
					<div class="mt-3 border-t border-current/20 pt-3 text-sm">{r.past && !r.tekortEigenGeld ? '✓ Deze woning is haalbaar' : '✕ Deze woning past (nog) niet'}</div>
				{/if}
			{/if}
		</div>

		{#if d.situatie !== 'oversluiten' && d.woningprijs}
			<div class="card grid grid-cols-2 gap-4 text-sm">
				<div><div class="text-xs text-white/45">Lening nodig</div><div class="num font-semibold">{euro(r.lening)}</div></div>
				<div><div class="text-xs text-white/45">Lening / waarde</div><div class="num font-semibold">{Math.round(r.ltv * 100)}%</div></div>
				<div><div class="text-xs text-white/45">Bruto per maand</div><div class="num font-semibold">{euro(r.maandBruto)}</div></div>
				<div><div class="text-xs text-white/45">Netto per maand (na aftrek)</div><div class="num font-semibold text-purple-200">{euro(r.maandNetto)}</div></div>
				<div><div class="text-xs text-white/45">Kosten koper</div><div class="num font-semibold">{euro(r.kostenKoper)}</div><div class="text-xs text-white/40">{r.startersvrijstelling ? 'geen overdrachtsbelasting' : `${euro(r.overdrachtsbelasting)} overdrachtsbel.`}</div></div>
				<div><div class="text-xs text-white/45">NHG</div><div class="font-semibold">{r.nhg ? `Ja · ${euro(r.nhgKosten)}` : 'Nee'}</div></div>
				<div class="col-span-2 border-t border-white/10 pt-3 text-xs text-white/55">
					Lineair: {euro(r.lineairStart)} → {euro(r.lineairEind)} p/m. Totale rente over 30 jaar: annuïtair {euro(r.totaleRenteAnnuitair)}, lineair {euro(r.totaleRenteLineair)} (scheelt {euro(r.totaleRenteAnnuitair - r.totaleRenteLineair)}).
				</div>
			</div>
		{/if}
	</aside>
</div>

{#if (d.situatie !== 'oversluiten' && d.woningprijs) || d.situatie === 'oversluiten'}
	<div class="mt-6 grid gap-6 lg:grid-cols-5">
		<section class="card lg:col-span-3">
			<h2 class="mb-4 font-semibold">Adviezen</h2>
			<TipList tips={r.tips} />
		</section>
		{#if d.situatie !== 'oversluiten' && r.lening > 0}
			<section class="card lg:col-span-2">
				<h2 class="mb-1 font-semibold">Restschuld over 30 jaar</h2>
				<p class="mb-3 text-xs text-white/45">Lineair los je sneller af en betaal je minder rente, maar de eerste jaren zijn de lasten hoger.</p>
				<Chart height={240} config={chart} />
			</section>
		{/if}
	</div>
{/if}
<p class="mt-6 text-xs text-white/35">Indicatie op basis van de Nibud-normen 2026 en een looptijd van 30 jaar. Banken rekenen met hun eigen tabellen en voorwaarden: laat je adviseren door een onafhankelijk hypotheekadviseur (AFM-register).</p>
