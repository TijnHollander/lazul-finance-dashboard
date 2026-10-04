<script lang="ts">
	import Icon from './Icon.svelte';
	import { fetchFundamentals, analyze, defaultAssumptions, type Fundamentals } from '$lib/analysis';
	import { tickerNotes, type TickerNote } from '$lib/stores';
	import { money, pct } from '$lib/format';

	let { symbol, livePrice = null }: { symbol: string; livePrice?: number | null } = $props();

	let data = $state<Fundamentals | null>(null);
	let error = $state<string | null>(null);
	let loading = $state(true);

	$effect(() => {
		const s = symbol;
		loading = true;
		error = null;
		data = null;
		if (s.startsWith('^') || s.includes('=') || /-(EUR|USD)$/.test(s)) {
			error = 'index';
			loading = false;
			return;
		}
		fetchFundamentals(s).then((r) => {
			if (s !== symbol) return;
			if ('error' in r) error = r.error;
			else data = { ...r, price: r.price ?? livePrice };
			loading = false;
		});
	});

	const note = $derived<TickerNote>($tickerNotes[symbol] ?? { voordeel: null, sticky: null, tienx: null, notitie: '' });
	function setNote(patch: Partial<TickerNote>) {
		tickerNotes.update((n) => ({ ...n, [symbol]: { ...note, ...patch } }));
	}

	const defs = $derived(data ? defaultAssumptions(data) : null);
	const growth = $derived(note.growth ?? defs?.growth ?? 0.1);
	const exitPE = $derived(note.exitPE ?? defs?.exitPE ?? 20);
	const a = $derived(data ? analyze(data, { growth: note.growth, exitPE: note.exitPE }) : null);

	const cur = $derived(data?.currency === 'GBp' ? 'GBP' : (data?.currency ?? 'USD'));
	const sym = $derived(cur === 'EUR' ? '€' : cur === 'USD' ? '$' : cur === 'GBP' ? '£' : cur);
	/** Grote bedragen leesbaar: 4,45 bln · 130,5 mld · 812 mln */
	const big = (v: number | null | undefined) => {
		if (v == null || !isFinite(v)) return '—';
		const a = Math.abs(v);
		const f = (n: number, d = 1) => n.toLocaleString('nl-NL', { maximumFractionDigits: d });
		if (a >= 1e12) return `${sym} ${f(v / 1e12, 2)} bln`;
		if (a >= 1e9) return `${sym} ${f(v / 1e9, a >= 1e11 ? 0 : 1)} mld`;
		if (a >= 1e6) return `${sym} ${f(v / 1e6, 0)} mln`;
		return `${sym} ${f(v, 0)}`;
	};
	const p = (v: number | null | undefined, d = 0) => (v == null ? '—' : `${(v * 100).toFixed(d).replace('.', ',')}%`);
	const x = (v: number | null | undefined) => (v == null ? '—' : `${v.toFixed(1).replace('.', ',')}×`);

	// oordeel: cijfers + eigen antwoorden
	const cijferScore = $derived.by(() => {
		if (!a) return 0;
		let s = 0;
		if (a.revenue.tone === 'pos') s++;
		if (a.eps.rising) s++;
		if (a.moatScore >= 60) s++;
		if (a.tenX.tone === 'pos') s++;
		if (a.analyst && a.analyst.buyPct >= 0.5) s++;
		return s;
	});
	const eigenScore = $derived([note.voordeel, note.sticky, note.tienx].filter((v) => v === 'ja').length);
</script>

{#snippet keuze(value: string | null, set: (v: 'ja' | 'twijfel' | 'nee') => void)}
	<div class="flex gap-1">
		{#each [['ja', 'Ja'], ['twijfel', 'Twijfel'], ['nee', 'Nee']] as [v, l] (v)}
			<button
				class="rounded-md border px-2.5 py-1 text-xs transition-colors {value === v
					? v === 'ja'
						? 'border-emerald-500/40 bg-emerald-950/40 text-emerald-200'
						: v === 'nee'
							? 'border-red-500/40 bg-red-950/40 text-red-200'
							: 'border-yellow-500/40 bg-yellow-950/30 text-yellow-100'
					: 'border-white/10 text-white/55 hover:text-white'}"
				onclick={() => set(v as 'ja' | 'twijfel' | 'nee')}>{l}</button
			>
		{/each}
	</div>
{/snippet}

<div class="mt-6 border-t border-white/10 pt-6">
	{#if loading}
		<div class="grid gap-3">{#each Array(3) as _, i (i)}<div class="h-16 animate-pulse rounded-lg bg-white/[0.03]"></div>{/each}</div>
	{:else if error === 'index'}
		<p class="text-sm text-white/45">Dit is een index, valuta of crypto: er is geen bedrijfsanalyse. Klik op een aandeel voor analistenrating, K/W en de 10x-check.</p>
	{:else if error}
		<p class="text-sm text-white/45">Analyse niet beschikbaar: {error}</p>
	{:else if data && data.type !== 'equity'}
		<p class="text-sm text-white/45">{data.name} is een {data.type === 'etf' ? 'ETF of fonds' : 'niet-aandeel'}: de groei- en 10x-analyse is bedoeld voor losse bedrijven.</p>
	{:else if data && a}
		<!-- ── kerncijfers -->
		<div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
			<div class="rounded-lg border border-white/10 bg-white/[0.02] p-3">
				<div class="text-xs text-white/45">Analisten</div>
				{#if a.analyst}
					<div class="mt-0.5 font-semibold {a.analyst.buyPct >= 0.5 ? 'text-emerald-300' : a.analyst.sellPct >= 0.3 ? 'text-red-300' : 'text-white'}">{a.analyst.label}</div>
					<div class="mt-2 flex h-1.5 overflow-hidden rounded-full bg-white/10" aria-hidden="true">
						<div class="bg-emerald-400" style="width:{a.analyst.buyPct * 100}%"></div>
						<div class="bg-white/30" style="width:{a.analyst.holdPct * 100}%"></div>
						<div class="bg-red-400" style="width:{a.analyst.sellPct * 100}%"></div>
					</div>
					<div class="mt-1.5 text-xs text-white/50">{p(a.analyst.buyPct)} kopen · {p(a.analyst.holdPct)} houden · {p(a.analyst.sellPct)} verkopen ({a.analyst.total})</div>
				{:else}<div class="mt-0.5 text-sm text-white/40">geen dekking</div>{/if}
			</div>
			<div class="rounded-lg border border-white/10 bg-white/[0.02] p-3">
				<div class="text-xs text-white/45">Koersdoel analisten</div>
				{#if data.analyst?.targetMean}
					<div class="num mt-0.5 font-semibold">{money(data.analyst.targetMean, cur)}</div>
					<div class="text-xs {a.analyst?.upside != null && a.analyst.upside >= 0 ? 'pos' : 'neg'}">{a.analyst?.upside != null ? `${pct(a.analyst.upside * 100, 0)} t.o.v. nu` : ''}</div>
					<div class="text-xs text-white/40">bandbreedte {money(data.analyst.targetLow, cur)} – {money(data.analyst.targetHigh, cur)}</div>
				{:else}<div class="mt-0.5 text-sm text-white/40">{data.source === 'Finnhub' ? 'niet in gratis Finnhub' : 'onbekend'}</div>{/if}
			</div>
			<div class="rounded-lg border border-white/10 bg-white/[0.02] p-3">
				<div class="text-xs text-white/45">K/W-verhouding (P/E)</div>
				<div class="num mt-0.5 font-semibold">{data.valuation.trailingPE ? data.valuation.trailingPE.toFixed(1).replace('.', ',') : '—'}</div>
				<div class="text-xs text-white/50">verwacht {data.valuation.forwardPE ? data.valuation.forwardPE.toFixed(1).replace('.', ',') : '—'}{data.valuation.peg ? ` · PEG ${data.valuation.peg.toFixed(2).replace('.', ',')}` : ''}</div>
				<div class="text-xs text-white/40">je betaalt {data.valuation.trailingPE ? Math.round(data.valuation.trailingPE) : '?'} jaar winst</div>
			</div>
			<div class="rounded-lg border border-white/10 bg-white/[0.02] p-3">
				<div class="text-xs text-white/45">Beurswaarde</div>
				<div class="num mt-0.5 font-semibold">{big(data.valuation.marketCap)}</div>
				<div class="text-xs text-white/50">{data.industry ?? ''}</div>
				<div class="text-xs text-white/40">{data.valuation.dividendYield ? `dividend ${p(data.valuation.dividendYield, 1)}` : 'geen dividend'}</div>
			</div>
		</div>
		{#if a.analyst}
			<p class="mt-2 text-xs text-white/40">Het percentage "kopen" is het aandeel analisten met een koopadvies, géén kans dat de koers stijgt. Analisten zitten er regelmatig naast.</p>
		{/if}

		<!-- ── groei -->
		<div class="mt-6 grid gap-4 2xl:grid-cols-2">
			<div>
				<h3 class="mb-2 text-sm font-semibold">Verdubbelt de omzet elke 1–2 jaar?</h3>
				<p class="text-sm {a.revenue.tone === 'pos' ? 'text-emerald-300' : a.revenue.tone === 'neg' ? 'text-red-300' : 'text-yellow-100'}">{a.revenue.verdict}</p>
				<p class="mt-1 text-xs text-white/50">Omzetgroei {p(a.revenue.cagr, 1)} per jaar{a.revenue.years ? ` over ${a.revenue.years} jaar` : ''}{data.growth.revenueYoY != null ? ` · laatste kwartaal ${pct(data.growth.revenueYoY * 100, 0)} j/j` : ''}. Verdubbelen in 2 jaar vraagt ± 41% per jaar, in 1 jaar 100%.</p>
				<h3 class="mt-4 mb-2 text-sm font-semibold">Stijgt de winst per aandeel (EPS)?</h3>
				<p class="text-sm {a.eps.rising ? 'text-emerald-300' : a.eps.rising === false ? 'text-red-300' : 'text-white/60'}">
					{a.eps.rising ? 'Ja' : a.eps.rising === false ? 'Nee' : 'Onbekend'}{a.eps.cagr != null ? `: ${p(a.eps.cagr, 1)} per jaar` : ''}{a.eps.years ? ` (${a.eps.yearsUp} van ${a.eps.years} jaar hoger)` : ''}
				</p>
				{#if a.eps.reasons.length}
					<ul class="mt-2 space-y-1.5 text-sm text-white/65">
						{#each a.eps.reasons as r (r)}<li class="flex gap-2"><span class="text-purple-300">→</span><span>{r}</span></li>{/each}
					</ul>
				{/if}
			</div>
			<div class="overflow-x-auto">
				{#if data.history.years.length}
					<table class="table text-xs">
						<thead><tr><th>Jaar</th><th class="text-right">Omzet</th><th class="text-right">EPS</th><th class="text-right whitespace-nowrap">Op. marge</th><th class="text-right">Aandelen</th></tr></thead>
						<tbody>
							{#each data.history.years as y, i (y)}
								<tr>
									<td class="text-white/60">{y}</td>
									<td class="num text-right whitespace-nowrap">{big(data.history.revenue[i])}</td>
									<td class="num text-right">{data.history.eps[i] != null ? data.history.eps[i]!.toFixed(2).replace('.', ',') : '—'}</td>
									<td class="num text-right">{data.history.operatingIncome[i] != null && data.history.revenue[i] ? p(data.history.operatingIncome[i]! / data.history.revenue[i]!) : '—'}</td>
									<td class="num text-right whitespace-nowrap text-white/55">{data.history.shares[i] ? `${(data.history.shares[i]! / 1e9).toFixed(2).replace('.', ',')} mld` : '—'}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				{:else}<p class="text-xs text-white/40">Geen jaarcijfers beschikbaar.</p>{/if}
			</div>
		</div>

		<!-- ── voorsprong -->
		<div class="mt-6">
			<div class="mb-2 flex items-center justify-between gap-3">
				<h3 class="text-sm font-semibold">Duidelijk competitief voordeel? Verdienmodel & plakkerigheid</h3>
				<span class="chip {a.moatScore >= 60 ? 'text-emerald-300' : a.moatScore >= 35 ? 'text-yellow-100' : 'text-red-300'}">moat-score {a.moatScore}/100</span>
			</div>
			<div class="mb-3 rounded-lg border border-purple-500/20 bg-purple-950/20 p-3 text-sm">
				<div><span class="text-white/50">Verdienmodel:</span> <span class="text-white/90">{a.model.model}</span></div>
				<div class="mt-1"><span class="text-white/50">Typisch voordeel:</span> <span class="text-white/80">{a.model.moat}</span></div>
			</div>
			<ul class="grid gap-2 sm:grid-cols-2">
				{#each a.indicators as ind (ind.label)}
					<li class="flex gap-2.5 rounded-lg bg-white/[0.02] p-2.5" title={ind.uitleg}>
						<span class="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full text-[11px] {ind.ok === true ? 'bg-emerald-950 text-emerald-300' : ind.ok === false ? 'bg-red-950 text-red-300' : 'bg-white/5 text-white/40'}">
							{ind.ok === true ? '✓' : ind.ok === false ? '✕' : '?'}
						</span>
						<div class="min-w-0">
							<div class="text-sm text-white/85">{ind.label} <span class="text-xs text-white/45">· {ind.value}</span></div>
							<div class="text-xs text-white/45">{ind.uitleg}</div>
						</div>
					</li>
				{/each}
			</ul>
			<div class="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
				<a class="inline-flex items-center gap-1 text-purple-300 hover:underline" href="https://patents.google.com/?assignee={encodeURIComponent(data.name.replace(/,? (Inc|Corp|Corporation|N\.V\.|NV|Holding|Holdings|plc|Ltd|SE|AG)\.?$/i, ''))}" target="_blank" rel="noopener">Patenten op naam van {data.name} <Icon name="external" class="size-3" /></a>
				{#if data.website}<a class="inline-flex items-center gap-1 text-purple-300 hover:underline" href={data.website} target="_blank" rel="noopener">Website & jaarverslag <Icon name="external" class="size-3" /></a>{/if}
			</div>
			{#if data.summary}
				<details class="mt-3 text-sm text-white/60">
					<summary class="cursor-pointer text-white/75 hover:text-white">Bedrijfsomschrijving (Engels, via {data.source})</summary>
					<p class="mt-2 leading-relaxed">{data.summary}</p>
				</details>
			{/if}
		</div>

		<!-- ── 10x -->
		<div class="mt-6 rounded-xl border border-purple-500/25 bg-purple-950/15 p-4">
			<h3 class="text-sm font-semibold">Kan dit aandeel 10× groeien in 5 jaar of langer?</h3>
			<p class="mt-1 text-xs text-white/50">
				10× in 5 jaar vraagt <b class="text-white/80">{p(a.tenX.neededCagr5, 1)}</b> koersgroei per jaar, in 10 jaar <b class="text-white/80">{p(a.tenX.neededCagr10, 1)}</b>. Ter vergelijking: de wereldwijde aandelenmarkt deed historisch ± 7–10%.
			</p>
			<div class="mt-4 grid gap-4 sm:grid-cols-2">
				<label class="grid gap-1.5">
					<span class="text-xs text-white/60">Winstgroei per jaar: <b class="num text-purple-200">{p(growth, 0)}</b> <span class="text-white/40">({a.tenX.growthSource})</span></span>
					<input type="range" min="-0.1" max="0.6" step="0.01" value={growth} oninput={(e) => setNote({ growth: Number((e.target as HTMLInputElement).value) })} class="accent-purple-400" />
				</label>
				<label class="grid gap-1.5">
					<span class="text-xs text-white/60">K/W over 5–10 jaar: <b class="num text-purple-200">{exitPE}</b> <span class="text-white/40">(nu {data.valuation.trailingPE ? Math.round(data.valuation.trailingPE) : '—'})</span></span>
					<input type="range" min="8" max="60" step="1" value={exitPE} oninput={(e) => setNote({ exitPE: Number((e.target as HTMLInputElement).value) })} class="accent-purple-400" />
				</label>
			</div>
			{#if note.growth != null || note.exitPE != null}
				<button class="mt-1 text-xs text-white/45 underline" onclick={() => setNote({ growth: undefined, exitPE: undefined })}>Terug naar standaardaannames</button>
			{/if}
			<div class="mt-4 grid grid-cols-3 gap-3 text-center">
				<div class="rounded-lg bg-black/30 p-3"><div class="text-xs text-white/45">Over 5 jaar</div><div class="num text-lg font-semibold">{x(a.tenX.multiple5)}</div></div>
				<div class="rounded-lg bg-black/30 p-3"><div class="text-xs text-white/45">Over 10 jaar</div><div class="num text-lg font-semibold">{x(a.tenX.multiple10)}</div></div>
				<div class="rounded-lg bg-black/30 p-3"><div class="text-xs text-white/45">10× bereikt na</div><div class="num text-lg font-semibold">{a.tenX.yearsTo10x != null ? `${a.tenX.yearsTo10x.toFixed(1).replace('.', ',')} jr` : '—'}</div></div>
			</div>
			<p class="mt-3 text-sm font-medium {a.tenX.tone === 'pos' ? 'text-emerald-300' : a.tenX.tone === 'warn' ? 'text-yellow-100' : 'text-red-300'}">{a.tenX.verdict}.</p>
			<ul class="mt-2 space-y-1 text-xs text-white/50">
				{#each a.tenX.notes as n (n)}<li>• {n}</li>{/each}
			</ul>
		</div>

		<!-- ── eigen oordeel -->
		<div class="mt-6">
			<h3 class="mb-3 text-sm font-semibold">Jouw oordeel</h3>
			<div class="grid gap-3">
				<div class="flex flex-wrap items-center justify-between gap-2"><span class="text-sm text-white/75">Heeft dit bedrijf een duidelijk voordeel (patenten, merk, netwerk)?</span>{@render keuze(note.voordeel, (v) => setNote({ voordeel: v }))}</div>
				<div class="flex flex-wrap items-center justify-between gap-2"><span class="text-sm text-white/75">Is het product sticky (blijven klanten jaren)?</span>{@render keuze(note.sticky, (v) => setNote({ sticky: v }))}</div>
				<div class="flex flex-wrap items-center justify-between gap-2"><span class="text-sm text-white/75">Geloof jij in 10× op 5 jaar of langer?</span>{@render keuze(note.tienx, (v) => setNote({ tienx: v }))}</div>
				<textarea class="input h-20 py-2" placeholder="Notities: waarom wel/niet, risico's, wat moet er gebeuren…" value={note.notitie} oninput={(e) => setNote({ notitie: (e.target as HTMLTextAreaElement).value })}></textarea>
			</div>
			<div class="mt-3 rounded-lg bg-white/[0.03] p-3 text-sm text-white/70">
				De cijfers scoren <b class="text-white">{cijferScore}/5</b> (omzetgroei, EPS, moat, 10×-som, analisten); jouw eigen antwoorden <b class="text-white">{eigenScore}/3</b> ja.
				{#if cijferScore >= 4 && eigenScore >= 2}Cijfers en overtuiging wijzen dezelfde kant op: een kandidaat om verder te onderzoeken.{:else if cijferScore >= 4}De cijfers zijn sterk; vul je eigen oordeel aan om je overtuiging te toetsen.{:else if cijferScore <= 2 && eigenScore >= 2}Let op: je overtuiging is sterker dan de cijfers onderbouwen.{:else}Gemengd beeld: zoek uit welke aanname het verschil maakt.{/if}
			</div>
			<p class="mt-3 text-xs text-white/35">Bron: {data.source}{data.partial ? ` (${data.partial})` : ''}. Automatische regels op basis van openbare cijfers: dit is geen beleggingsadvies. Grote rendementen gaan samen met grote risico's.</p>
		</div>
	{/if}
</div>
