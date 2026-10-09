<script lang="ts">
	import Chart from './Chart.svelte';
	import Icon from './Icon.svelte';
	import { bespaarplan, huishouden } from '$lib/stores';
	import { analyseer, prognose, fv } from '$lib/savings';
	import { FIXED, NEUTRAL, type Category, type CashflowSummary } from '$lib/cashflow';
	import type { BankTx } from '$lib/parsers/bank';
	import { euro, compactEuro } from '$lib/format';
	import { SERIES, INK } from '$lib/palette';
	import { BRONNEN_2026 } from '$lib/reports/fiscaal2026';

	let { tx, cats, s }: { tx: BankTx[]; cats: Map<string, Category>; s: CashflowSummary } = $props();

	const a = $derived(analyseer(tx, cats, s, $huishouden));
	const over = $derived(s.wAvgIncome - s.wAvgExpenses);

	// categorieën waarop je kunt schuiven: variabel + telecom/abonnementen
	const schuifbaar = $derived(
		s.categoryAvg.filter((c) => !NEUTRAL.includes(c.category) && (!FIXED.includes(c.category) || c.category === 'Telecom & abonnementen') && c.avg >= 20).slice(0, 7)
	);
	const pct = (c: string) => $bespaarplan[c] ?? 0;
	function setPct(c: string, v: number) {
		bespaarplan.update((p) => ({ ...p, [c]: v }));
	}
	const aboOpzeg = (naam: string) => !!$bespaarplan[`abo:${naam}`];
	function toggleAbo(naam: string) {
		bespaarplan.update((p) => ({ ...p, [`abo:${naam}`]: p[`abo:${naam}`] ? 0 : 100 }));
	}
	const besparing = $derived(
		schuifbaar.reduce((t, c) => t + (c.avg * pct(c.category)) / 100, 0) + a.abonnementen.filter((x) => aboOpzeg(x.naam)).reduce((t, x) => t + x.bedrag, 0)
	);
	function gebruikVoorstel() {
		bespaarplan.update((p) => {
			const n = { ...p };
			for (const c of schuifbaar) n[c.category] = a.voorstel[c.category] ?? (c.category === 'Uit eten & horeca' || c.category === 'Winkelen' ? 10 : 0);
			return n;
		});
	}
	function resetPlan() {
		bespaarplan.set({});
	}

	const prog = $derived(prognose(over, besparing, 24));
	const tienJaar = $derived(fv(besparing, 10));

	const toneCls = { pos: 'border-emerald-500/25 bg-emerald-950/15', warn: 'border-orange-500/25 bg-orange-950/15', info: 'border-white/10 bg-white/[0.02]' };
	const toneIcon = { pos: 'text-emerald-300', warn: 'text-orange-300', info: 'text-purple-300' };

	// ── grafieken
	const benchChart = $derived({
		type: 'bar',
		data: {
			labels: a.benchmarks.map((b) => b.category),
			datasets: [
				{ label: 'Jij (gem. per maand)', data: a.benchmarks.map((b) => Math.round(b.avg)), backgroundColor: a.benchmarks.map((b) => (b.boven > 10 ? SERIES[1] : SERIES[0])), borderRadius: 4, maxBarThickness: 14 },
				{ label: 'Richtbedrag', data: a.benchmarks.map((b) => Math.round(b.richt)), backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 4, maxBarThickness: 14 }
			]
		},
		options: {
			indexAxis: 'y',
			maintainAspectRatio: false,
			interaction: { mode: 'index', intersect: false },
			scales: { x: { grid: { color: INK.grid }, ticks: { callback: (v: any) => euro(v) } }, y: { grid: { display: false }, ticks: { color: INK.primary } } },
			plugins: {
				legend: { position: 'top', align: 'end' },
				tooltip: { callbacks: { label: (c: any) => ` ${c.dataset.label}: ${euro(c.parsed.x)}`, footer: (it: any[]) => a.benchmarks[it[0].dataIndex].basis } }
			}
		}
	});

	const v = $derived(a.verdeling);
	const tot = $derived(Math.max(1, v.inkomen));
	const splitChart = $derived({
		type: 'bar',
		data: {
			labels: ['Jij', '50/30/20-regel'],
			datasets: [
				{ label: 'Noodzakelijk', data: [(v.nodig / tot) * 100, 50], backgroundColor: SERIES[5], borderColor: '#000', borderWidth: { right: 2 }, borderSkipped: false },
				{ label: 'Wensen', data: [(v.wensen / tot) * 100, 30], backgroundColor: SERIES[1], borderColor: '#000', borderWidth: { right: 2 }, borderSkipped: false },
				{ label: 'Sparen & beleggen', data: [(v.sparen / tot) * 100, 20], backgroundColor: SERIES[2], borderSkipped: false }
			]
		},
		options: {
			indexAxis: 'y',
			maintainAspectRatio: false,
			scales: { x: { stacked: true, max: 100, grid: { color: INK.grid }, ticks: { callback: (x: any) => `${x}%` } }, y: { stacked: true, grid: { display: false }, ticks: { color: INK.primary } } },
			plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { label: (c: any) => ` ${c.dataset.label}: ${c.parsed.x.toFixed(0)}%${c.dataIndex === 0 ? ` (${euro((c.parsed.x / 100) * v.inkomen)})` : ''}` } } }
		}
	});

	const DAGEN = ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo'];
	const piekDag = $derived(a.weekdag.indexOf(Math.max(...a.weekdag)));
	const dagChart = $derived({
		type: 'bar',
		data: { labels: DAGEN, datasets: [{ label: 'Gem. per week', data: a.weekdag.map((x) => Math.round(x)), backgroundColor: a.weekdag.map((_, i) => (i === piekDag ? SERIES[1] : SERIES[0])), borderRadius: 4, maxBarThickness: 28 }] },
		options: { maintainAspectRatio: false, scales: { x: { grid: { display: false } }, y: { grid: { color: INK.grid }, ticks: { callback: (x: any) => euro(x) } } }, plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c: any) => ` ${euro(c.parsed.y)} per ${DAGEN[c.dataIndex]}` } } } }
	});

	const progChart = $derived({
		type: 'line',
		data: {
			labels: prog.map((p) => (p.maand === 0 ? 'nu' : p.maand % 6 === 0 ? `${p.maand} mnd` : '')),
			datasets: [
				{ label: 'Met bespaarplan', data: prog.map((p) => Math.round(p.plan)), borderColor: SERIES[0], backgroundColor: 'rgba(144,133,233,0.14)', fill: '+1', borderWidth: 2.5, pointRadius: 0, tension: 0.1 },
				{ label: 'Huidig tempo', data: prog.map((p) => Math.round(p.nu)), borderColor: SERIES[1], borderWidth: 2, borderDash: [6, 4], pointRadius: 0, tension: 0.1 },
				{ label: 'Besparing belegd (6%)', data: prog.map((p) => Math.round(p.belegd)), borderColor: SERIES[2], borderWidth: 2, pointRadius: 0, tension: 0.1 }
			]
		},
		options: {
			maintainAspectRatio: false,
			interaction: { mode: 'index', intersect: false },
			scales: { x: { grid: { display: false }, ticks: { autoSkip: false, maxRotation: 0 } }, y: { grid: { color: INK.grid }, ticks: { callback: (x: any) => compactEuro(x) } } },
			plugins: { legend: { position: 'top', align: 'end' }, tooltip: { callbacks: { title: (it: any[]) => `Over ${prog[it[0].dataIndex].maand} maanden`, label: (c: any) => ` ${c.dataset.label}: ${euro(c.parsed.y)}` } } }
		}
	});
</script>

<!-- huishouden -->
<div class="mb-6 flex flex-wrap items-center gap-3 text-sm">
	<span class="text-white/55">Huishouden voor de richtbedragen:</span>
	<select class="input h-9 w-auto" bind:value={$huishouden.volwassenen} aria-label="Volwassenen">
		<option value={1}>1 volwassene</option>
		<option value={2}>2 volwassenen</option>
		<option value={3}>3 volwassenen</option>
	</select>
	<select class="input h-9 w-auto" bind:value={$huishouden.kinderen} aria-label="Kinderen">
		{#each [0, 1, 2, 3, 4] as k (k)}<option value={k}>{k} {k === 1 ? 'kind' : 'kinderen'}</option>{/each}
	</select>
</div>

<!-- inzichten -->
<section class="mb-6">
	<h2 class="mb-3 text-lg font-semibold">Wat ons opvalt in je uitgaven</h2>
	{#if a.inzichten.length}
		<div class="grid gap-3 md:grid-cols-2">
			{#each a.inzichten as i (i.id)}
				<div class="flex gap-3 rounded-xl border p-4 {toneCls[i.tone]}">
					<div class="mt-0.5 {toneIcon[i.tone]}"><Icon name={i.icon} class="size-5" /></div>
					<div class="min-w-0 flex-1">
						<div class="flex flex-wrap items-baseline justify-between gap-2">
							<span class="font-medium text-white">{i.titel}</span>
							{#if i.besparing > 5}<span class="chip text-emerald-300">± {euro(i.besparing)} p/m</span>{/if}
						</div>
						<p class="mt-1 text-sm text-white/65">{i.tekst}</p>
					</div>
				</div>
			{/each}
		</div>
	{:else}
		<p class="text-sm text-white/50">Geen opvallende patronen: je uitgaven zitten netjes binnen de richtbedragen.</p>
	{/if}
</section>

<!-- bespaarplan + prognose -->
<section class="mb-6 grid gap-6 lg:grid-cols-5">
	<div class="glass min-w-0 p-6 lg:col-span-2">
		<div class="mb-1 flex flex-wrap items-center justify-between gap-2">
			<h2 class="font-semibold">Jouw bespaarplan</h2>
			<div class="flex gap-2">
				<button class="btn btn-ghost px-3 py-1 text-xs" onclick={gebruikVoorstel}>Voorstel</button>
				<button class="btn btn-ghost px-3 py-1 text-xs" onclick={resetPlan}>Reset</button>
			</div>
		</div>
		<p class="mb-4 text-xs text-white/45">Schuif per categorie hoeveel je minder wilt uitgeven. De grafiek rekent direct mee.</p>
		<div class="space-y-4">
			{#each schuifbaar as c (c.category)}
				<label class="grid gap-1.5">
					<span class="flex flex-wrap items-center justify-between gap-x-2 text-sm">
						<span class="text-white/80">{c.category} <span class="text-xs text-white/40">{euro(c.avg)} p/m</span></span>
						<span class="num {pct(c.category) ? 'text-emerald-300' : 'text-white/40'}">{pct(c.category) ? `−${pct(c.category)}% · ${euro((c.avg * pct(c.category)) / 100)}` : '—'}</span>
					</span>
					<input type="range" min="0" max="50" step="5" value={pct(c.category)} oninput={(e) => setPct(c.category, Number((e.target as HTMLInputElement).value))} class="accent-purple-400" />
				</label>
			{/each}
		</div>
		{#if a.abonnementen.length}
			<div class="mt-5 border-t border-white/10 pt-4">
				<div class="mb-2 text-sm font-medium">Vaste afschrijvingen: welke zeg je op?</div>
				<ul class="space-y-1.5">
					{#each a.abonnementen as ab (ab.naam)}
						<li>
							<label class="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 text-sm hover:bg-white/[0.03]">
								<input type="checkbox" class="size-4 accent-purple-400" checked={aboOpzeg(ab.naam)} onchange={() => toggleAbo(ab.naam)} />
								<span class="min-w-0 flex-1 truncate {aboOpzeg(ab.naam) ? 'text-white/40 line-through' : 'text-white/80'}">{ab.naam}{#if ab.streaming}<span class="chip ml-2 px-1.5 py-0 text-[10px]">streaming</span>{/if}</span>
								<span class="num text-white/60">{euro(ab.bedrag, true)}</span>
								<span class="num hidden w-20 text-right text-xs text-white/40 sm:inline">{euro(ab.perJaar)}/jr</span>
							</label>
						</li>
					{/each}
				</ul>
			</div>
		{/if}
	</div>

	<div class="card min-w-0 lg:col-span-3">
		<h2 class="mb-1 font-semibold">Voorspelling: wat levert het op?</h2>
		<p class="mb-4 text-xs text-white/45">Cumulatief overgehouden geld in de komende 24 maanden, nu en met je bespaarplan.</p>
		<div class="mb-4 grid grid-cols-3 gap-3 text-center">
			<div class="rounded-lg bg-white/[0.03] p-3"><div class="text-xs text-white/45">Extra per maand</div><div class="num text-xl font-semibold text-emerald-300">{euro(besparing)}</div></div>
			<div class="rounded-lg bg-white/[0.03] p-3"><div class="text-xs text-white/45">Extra per jaar</div><div class="num text-xl font-semibold">{euro(besparing * 12)}</div></div>
			<div class="rounded-lg border border-purple-500/25 bg-purple-950/30 p-3"><div class="text-xs text-white/45">Belegd na 10 jaar</div><div class="num text-xl font-semibold text-purple-200">{compactEuro(tienJaar)}</div></div>
		</div>
		<Chart height={280} config={progChart} />
		{#if besparing > 0}
			<p class="mt-3 text-sm text-white/65">
				Zet deze {euro(besparing)} op je salarisdag automatisch over naar je spaar- of beleggingsrekening. Dan gebeurt het echt, en mis je het na twee maanden niet meer. Je spaarquote gaat van <b class="text-white">{Math.round((over / Math.max(1, s.wAvgIncome)) * 100)}%</b> naar <b class="text-emerald-300">{Math.round(((over + besparing) / Math.max(1, s.wAvgIncome)) * 100)}%</b>.
			</p>
		{:else}
			<p class="mt-3 text-sm text-white/50">Schuif links een categorie omlaag of klik op "Voorstel" om te zien wat besparen oplevert.</p>
		{/if}
	</div>
</section>

<!-- vergelijking + patronen -->
<section class="mb-6 grid gap-6 lg:grid-cols-2">
	<div class="card">
		<h2 class="mb-1 font-semibold">Jij vs. richtbedrag</h2>
		<p class="mb-3 text-xs text-white/45">Oranje = boven het richtbedrag voor jouw huishouden. Voeding volgens het <a class="underline" href={BRONNEN_2026.nibud.url} target="_blank" rel="noopener">Nibud</a>, de rest zijn vuistregels.</p>
		<Chart height={Math.max(220, a.benchmarks.length * 38)} config={benchChart} />
	</div>
	<div class="flex flex-col gap-6">
		<div class="card">
			<h2 class="mb-1 font-semibold">Hoe verdeel je je inkomen?</h2>
			<p class="mb-3 text-xs text-white/45">De 50/30/20-regel: 50% noodzakelijk, 30% wensen, 20% sparen en beleggen.</p>
			<Chart height={170} config={splitChart} />
		</div>
		<div class="card">
			<h2 class="mb-1 font-semibold">Wanneer geef je het meest uit?</h2>
			<p class="mb-3 text-xs text-white/45">Variabele uitgaven per weekdag. Piek op <b class="text-white/70">{['maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag', 'zondag'][piekDag]}</b>{a.salarisEffect ? `; in de week na je salaris ${a.salarisEffect.pct >= 0 ? `${Math.round(a.salarisEffect.pct * 100)}% meer` : `${Math.round(-a.salarisEffect.pct * 100)}% minder`} dan normaal` : ''}.</p>
			<Chart height={170} config={dagChart} />
		</div>
	</div>
</section>

{#if a.horeca}
	<section class="card mb-6">
		<h2 class="mb-3 font-semibold">Uit eten, bars & bezorging onder de loep</h2>
		<div class="grid gap-4 sm:grid-cols-4">
			<div><div class="text-xs text-white/45">Per maand</div><div class="num text-lg font-semibold">{euro(a.horeca.perMaand)}</div></div>
			<div><div class="text-xs text-white/45">Keer per maand</div><div class="num text-lg font-semibold">{a.horeca.bezoekenPerMaand.toFixed(1).replace('.', ',')}</div></div>
			<div><div class="text-xs text-white/45">Gemiddelde bon</div><div class="num text-lg font-semibold">{euro(a.horeca.gemBon)}</div></div>
			<div><div class="text-xs text-white/45">Bezorging / weekend</div><div class="num text-lg font-semibold">{Math.round(a.horeca.bezorgPct * 100)}% / {Math.round(a.horeca.weekendPct * 100)}%</div></div>
		</div>
		<div class="mt-4 grid gap-4 md:grid-cols-2">
			<ul class="space-y-1.5 text-sm">
				{#each a.horeca.top as t (t.naam)}
					<li class="flex justify-between gap-3"><span class="truncate text-white/75">{t.naam}</span><span class="num shrink-0 text-white/55">{t.keer}× · {euro(t.totaal)}</span></li>
				{/each}
			</ul>
			<div class="rounded-lg bg-white/[0.03] p-4 text-sm text-white/70">
				<b class="text-white">Slim besparen zonder het leuke kwijt te raken:</b>
				<ul class="mt-2 list-disc space-y-1 pl-5 marker:text-purple-300">
					<li>Kook vaker en kies bewust je "uit eten"-momenten: {a.horeca.bezoekenPerMaand >= 8 ? 'één keer per week minder' : 'een paar keer per maand minder'} scheelt ± {euro(a.horeca.besparingEenMinderPerWeek)} per maand.</li>
					{#if a.horeca.bezorgPct > 0.15}<li>Bezorging kost gemiddeld 30–40% meer dan afhalen: haal het zelf op.</li>{/if}
					<li>Spreek af in plaats van uit: drankjes thuis of in het park.</li>
					<li>Zet een apart "uitgaan"-potje met een vast maandbedrag; als het op is, is het op.</li>
				</ul>
			</div>
		</div>
	</section>
{/if}
