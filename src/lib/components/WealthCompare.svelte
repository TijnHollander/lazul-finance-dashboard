<script lang="ts">
	import Chart from './Chart.svelte';
	import { CBS, CBS_GROUPS, CBS_PEILDATUM, CBS_URL, VERMOGEN_LABEL, cbsAt, groupIndex, percentileEstimate, projecteer, type Resultaat, type VermogenSoort } from '$lib/report';
	import { settings } from '$lib/stores';
	import { euro, compactEuro } from '$lib/format';
	import { SERIES, INK, BRAND } from '$lib/palette';

	let { res, compact = false }: { res: Resultaat; compact?: boolean } = $props();

	let soort = $state<VermogenSoort>('exclWoning');
	let extra = $state(100);
	const leeftijd = $derived(res.leeftijd ?? 30);
	const gi = $derived(groupIndex(leeftijd));
	const groep = $derived(CBS_GROUPS[gi]);
	const mijn = $derived(soort === 'totaal' ? res.vermogen.totaal : soort === 'exclWoning' ? res.vermogen.exclWoning : res.vermogen.financieel);
	const mediaan = $derived(CBS[soort].median[gi] * 1000);
	const gemiddeld = $derived(CBS[soort].mean[gi] * 1000);
	const verschil = $derived(mijn - mediaan);
	const percentiel = $derived(percentileEstimate(mijn, leeftijd, soort));

	const startBelegd = $derived(Math.max(0, res.vermogen.financieel - res.buffer.huidig));
	const basisStart = $derived(mijn);
	const proj = $derived(
		projecteer({ leeftijd, start: basisStart, startBelegd, maandSparen: Math.max(0, res.maandSparen), maandBeleggen: Math.max(0, res.maandBeleggen), rendement: $settings.expectedReturn, spaarrente: $settings.savingsRate, inflatie: $settings.inflation, tot: 67 })
	);
	const projExtra = $derived(
		projecteer({ leeftijd, start: basisStart, startBelegd, maandSparen: Math.max(0, res.maandSparen), maandBeleggen: Math.max(0, res.maandBeleggen) + extra, rendement: $settings.expectedReturn, spaarrente: $settings.savingsRate, inflatie: $settings.inflation, tot: 67 })
	);
	const ages = $derived(Array.from({ length: 70 - 20 + 1 }, (_, i) => 20 + i));
	const at67 = $derived(proj.find((p) => p.leeftijd === 67)?.waarde ?? 0);
	const at67Extra = $derived(projExtra.find((p) => p.leeftijd === 67)?.waarde ?? 0);
	/** Op welke leeftijd haal je het gemiddelde vermogen van 55–65-jarigen (piek in Nederland)? */
	const doelGemiddeld = $derived(CBS[soort].mean[4] * 1000);
	const haaltDoel = $derived(proj.find((p) => p.waarde >= doelGemiddeld)?.leeftijd ?? null);
	const haaltDoelExtra = $derived(projExtra.find((p) => p.waarde >= doelGemiddeld)?.leeftijd ?? null);

	const config = $derived({
		type: 'line',
		data: {
			labels: ages,
			datasets: ([
				{
					label: 'Jouw koers (huidig tempo)',
					data: ages.map((a) => proj.find((p) => p.leeftijd === a)?.waarde ?? null),
					borderColor: SERIES[0],
					backgroundColor: 'rgba(144,133,233,0.12)',
					fill: true,
					borderWidth: 2.5,
					pointRadius: 0,
					tension: 0.25
				},
				{
					label: `Met € ${extra} extra beleggen p/m`,
					data: ages.map((a) => projExtra.find((p) => p.leeftijd === a)?.waarde ?? null),
					borderColor: BRAND,
					borderDash: [6, 4],
					borderWidth: 2,
					pointRadius: 0,
					tension: 0.25
				},
				{ label: 'Mediaan Nederland', data: ages.map((a) => cbsAt(a, soort, 'median')), borderColor: SERIES[5], borderWidth: 2, pointRadius: 0, tension: 0.3 },
				{ label: 'Gemiddelde Nederland', data: ages.map((a) => cbsAt(a, soort, 'mean')), borderColor: SERIES[1], borderWidth: 2, pointRadius: 0, tension: 0.3 },
				{
					label: 'Jij nu',
					data: ages.map((a) => (a === leeftijd ? mijn : null)),
					borderColor: '#fff',
					backgroundColor: SERIES[0],
					pointRadius: 7,
					pointHoverRadius: 9,
					pointBorderWidth: 2,
					showLine: false
				}
			] as any[]).filter((ds) => !(compact && ds.borderDash))
		},
		options: {
			maintainAspectRatio: false,
			interaction: { mode: 'index', intersect: false },
			scales: {
				x: { grid: { display: false }, ticks: { callback: (_: any, i: number) => (ages[i] % 5 === 0 ? ages[i] : '') }, title: { display: !compact, text: 'Leeftijd', color: INK.muted } },
				y: { grid: { color: INK.grid }, ticks: { callback: (v: any) => compactEuro(v) } }
			},
			plugins: {
				legend: { position: 'bottom', labels: { filter: (l: any) => l.text !== 'Jij nu' || true } },
				tooltip: {
					callbacks: {
						title: (it: any[]) => `${it[0].label} jaar`,
						label: (c: any) => (c.parsed.y == null ? '' : ` ${c.dataset.label}: ${euro(c.parsed.y)}`)
					}
				}
			}
		}
	});
</script>

<div class="flex flex-col gap-4">
	{#if !compact}
		<div class="flex flex-wrap gap-2">
			{#each Object.keys(VERMOGEN_LABEL) as k (k)}
				<button class="btn {soort === k ? 'btn-primary' : 'btn-ghost'} py-1.5 text-xs" onclick={() => (soort = k as VermogenSoort)}>{VERMOGEN_LABEL[k as VermogenSoort]}</button>
			{/each}
		</div>
	{/if}

	<div class="grid gap-3 sm:grid-cols-3">
		<div class="rounded-lg border border-white/10 bg-white/[0.02] p-4">
			<div class="text-xs text-white/50">Jouw {VERMOGEN_LABEL[soort].toLowerCase()}</div>
			<div class="num mt-1 text-xl font-semibold">{euro(mijn)}</div>
			<div class="text-xs text-white/45">{leeftijd} jaar · groep {groep.label}</div>
		</div>
		<div class="rounded-lg border p-4 {verschil >= 0 ? 'border-emerald-500/25 bg-emerald-950/20' : 'border-orange-500/25 bg-orange-950/20'}">
			<div class="text-xs text-white/50">t.o.v. de mediaan ({euro(mediaan)})</div>
			<div class="num mt-1 text-xl font-semibold {verschil >= 0 ? 'text-emerald-300' : 'text-orange-300'}">{verschil >= 0 ? '+' : '−'}{euro(Math.abs(verschil))}</div>
			<div class="text-xs text-white/45">{verschil >= 0 ? 'Je loopt voor op de helft van je leeftijdsgenoten' : 'Nog even doorbouwen: het kan sneller dan je denkt'}</div>
		</div>
		<div class="rounded-lg border border-purple-500/25 bg-purple-950/20 p-4">
			<div class="text-xs text-white/50">Geschatte positie</div>
			<div class="num mt-1 text-xl font-semibold text-purple-200">{percentiel != null ? `Beter dan ±${percentiel}%` : '—'}</div>
			<div class="text-xs text-white/45">van huishoudens {groep.label} jaar (gemiddelde: {compactEuro(gemiddeld)})</div>
		</div>
	</div>

	<Chart height={compact ? 240 : 340} {config} />

	{#if !compact}
		<div class="grid gap-4 rounded-lg border border-white/10 bg-white/[0.02] p-4 sm:grid-cols-2">
			<label class="grid gap-2">
				<span class="text-sm text-white/75">Wat als ik <b class="num text-purple-200">€ {extra}</b> per maand extra beleg?</span>
				<input type="range" min="0" max="1000" step="25" bind:value={extra} class="accent-purple-400" />
			</label>
			<div class="text-sm text-white/70">
				Op je 67e: <b class="num text-white">{euro(at67)}</b> → <b class="num text-purple-200">{euro(at67Extra)}</b>
				<span class="text-white/45">(+{euro(at67Extra - at67)})</span>.
				<br />Het gemiddelde van 55–65-jarigen ({compactEuro(doelGemiddeld)}) bereik je
				{#if haaltDoel}in dit tempo rond je <b class="text-white">{haaltDoel}e</b>{#if haaltDoelExtra && haaltDoelExtra < haaltDoel}, met de extra inleg al rond je <b class="text-purple-200">{haaltDoelExtra}e</b>{/if}.{:else if haaltDoelExtra}alleen met de extra inleg, rond je <b class="text-purple-200">{haaltDoelExtra}e</b>.{:else}nog niet vóór je 67e. Elke euro extra helpt.{/if}
			</div>
		</div>
		<p class="text-xs text-white/40">
			Bron: <a class="underline" href={CBS_URL} target="_blank" rel="noopener">CBS StatLine 83834NED</a>, vermogen van huishoudens naar leeftijd hoofdkostwinner, peildatum {CBS_PEILDATUM} (voorlopige cijfers). CBS meet per huishouden; jouw cijfer is wat jij invult (bij samenwonen: tel het gezamenlijke vermogen). Projectie tot je 67e in euro's van nu (na {$settings.inflation}% inflatie), beleggen tegen {$settings.expectedReturn}% en sparen tegen {$settings.savingsRate}% per jaar, eigen woning gelijk gehouden. De positie is een schatting met een lognormale benadering. Rendementen uit het verleden bieden geen garantie voor de toekomst.
		</p>
	{/if}
</div>
