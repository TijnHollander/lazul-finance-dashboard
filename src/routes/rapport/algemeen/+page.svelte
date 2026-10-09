<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { base } from '$app/paths';
	import MoneyField from '$lib/components/MoneyField.svelte';
	import WealthCompare from '$lib/components/WealthCompare.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import { rapport, profile } from '$lib/stores';
	import { portfolio } from '$lib/portfolio';
	import { bereken, emptyRapport, afgeleidRisico, BRONNEN, type RapportData } from '$lib/report';
	import { euro, pct, dateNl } from '$lib/format';

	const STAPPEN = ['Over jou', 'Inkomsten', 'Vaste lasten', 'Variabele uitgaven', 'Vermogen & schulden', 'Doelen & risico'];
	let stap = $state(0); // 0 = resultaten
	let d = $state<RapportData>(structuredClone($rapport.data ?? emptyRapport($profile?.birthYear ?? null)));

	onMount(() => {
		const s = Number(page.url.searchParams.get('stap'));
		if (s >= 1 && s <= 6) {
			d = structuredClone($rapport.data ?? emptyRapport($profile?.birthYear ?? null));
			stap = s;
		} else if (!$rapport.savedAt) stap = 1;
	});

	const live = $derived(bereken(d, $portfolio.totalValue + $portfolio.cash));
	const saved = $derived($rapport.data && $rapport.savedAt ? bereken($rapport.data, $portfolio.totalValue + $portfolio.cash) : null);

	function next() {
		if (stap < 6) stap++;
		else save();
		window.scrollTo({ top: 0, behavior: 'smooth' });
	}
	function prev() {
		if (stap > 1) stap--;
		else if ($rapport.savedAt) stap = 0;
	}
	function save() {
		if (!d.risico) d.risico = afgeleidRisico(d);
		rapport.set({ data: $state.snapshot(d) as RapportData, savedAt: new Date().toISOString() });
		stap = 0;
	}
	function edit(s = 1) {
		d = structuredClone($rapport.data ?? emptyRapport($profile?.birthYear ?? null));
		stap = s;
	}
	function remove() {
		if (confirm('Rapport verwijderen?')) {
			rapport.set({ data: null, savedAt: null });
			d = emptyRapport($profile?.birthYear ?? null);
			stap = 1;
		}
	}

	const isStudent = $derived(d.werkstatus === 'student');
	const scoreColor = (s: number) => (s >= 65 ? '#34d399' : s >= 45 ? '#eab308' : '#f87171');
</script>

<svelte:head><title>Rapport · Lazul Finance</title></svelte:head>

{#snippet keuze(opts: [string, string][], value: string | null, set: (v: any) => void)}
	<div class="flex flex-wrap gap-2">
		{#each opts as [v, l] (v)}
			<button type="button" class="btn {value === v ? 'btn-primary' : 'btn-ghost'} py-1.5" onclick={() => set(v)}>{l}</button>
		{/each}
	</div>
{/snippet}

{#if stap > 0}
	<!-- ───────────── VRAGENLIJST ───────────── -->
	<div class="mx-auto max-w-3xl">
		<header class="mb-6">
			<a href="{base}/rapport/" class="mb-2 inline-flex items-center gap-1 text-xs text-white/45 hover:text-white">← Alle rapporten</a>
			<p class="text-sm text-purple-300">Algemeen rapport · stap {stap} van 6</p>
			<h1 class="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">{STAPPEN[stap - 1]}</h1>
			<div class="mt-4 flex gap-1.5" aria-hidden="true">
				{#each STAPPEN as _, i (i)}
					<button class="h-1.5 flex-1 rounded-full transition-colors {i + 1 <= stap ? 'bg-purple-400' : 'bg-white/10'}" onclick={() => (stap = i + 1)} tabindex="-1" aria-label="Stap {i + 1}"></button>
				{/each}
			</div>
		</header>

		<div class="glass p-6 sm:p-8">
			{#if stap === 1}
				<div class="grid gap-6">
					<div class="grid gap-4 sm:grid-cols-2">
						<MoneyField label="Geboortejaar" bind:value={d.geboortejaar} suffix="" placeholder="1995" hint="Voor de vergelijking met leeftijdsgenoten (CBS)." />
						<div class="grid gap-1.5">
							<span class="label">Aantal kinderen thuis</span>
							<input class="input" type="number" min="0" max="10" bind:value={d.kinderen} />
						</div>
					</div>
					<div class="grid gap-2">
						<span class="label">Huishouden</span>
						{@render keuze([['alleen', 'Alleenstaand'], ['samen', 'Samenwonend / getrouwd']], d.samenwonend ? 'samen' : 'alleen', (v) => (d.samenwonend = v === 'samen'))}
					</div>
					<div class="grid gap-2">
						<span class="label">Wat doe je?</span>
						{@render keuze(
							[['loondienst', 'Loondienst'], ['zelfstandig', 'Zzp / ondernemer'], ['student', 'Student'], ['werkzoekend', 'Werkzoekend / uitkering'], ['pensioen', 'Gepensioneerd'], ['anders', 'Anders']],
							d.werkstatus,
							(v) => (d.werkstatus = v)
						)}
					</div>
					<div class="grid gap-2">
						<span class="label">Woonsituatie</span>
						{@render keuze(
							[['huur_sociaal', 'Sociale huur'], ['huur_vrij', 'Vrije sector huur'], ['koop', 'Koopwoning'], ['bij_ouders', 'Bij ouders'], ['anders', 'Anders']],
							d.woonsituatie,
							(v) => (d.woonsituatie = v)
						)}
					</div>
					<label class="flex items-center gap-3 text-sm text-white/80"><input type="checkbox" class="size-4 accent-purple-400" bind:checked={d.auto} /> Ik heb een auto (eigen of lease op eigen kosten)</label>
				</div>
			{:else if stap === 2}
				<div class="grid gap-5">
					<p class="text-sm text-white/55">Alle bedragen <b class="text-white/80">netto per maand</b>, zoals ze op je rekening binnenkomen. Tip: laat dit automatisch invullen vanuit <a class="underline" href="{base}/uitgaven/">Uitgaven & inkomsten</a>.</p>
					<div class="grid gap-4 sm:grid-cols-2">
						<MoneyField label={d.werkstatus === 'zelfstandig' ? 'Netto opname uit je bedrijf' : isStudent ? 'Inkomen uit bijbaan' : d.werkstatus === 'werkzoekend' ? 'Uitkering (WW/bijstand)' : d.werkstatus === 'pensioen' ? 'AOW + pensioen' : 'Netto salaris'} bind:value={d.nettoInkomen} hint={d.werkstatus === 'zelfstandig' ? 'Wat je maandelijks voor jezelf opneemt, na reservering van btw en belasting.' : ''} />
						{#if d.samenwonend}<MoneyField label="Netto inkomen partner" bind:value={d.partnerInkomen} />{/if}
						{#if d.werkstatus === 'loondienst'}<MoneyField label="Vakantiegeld / 13e maand (netto per jaar)" suffix="€ / jaar" bind:value={d.jaarlijksExtra} hint="Wordt omgerekend naar een maandbedrag." />{/if}
						{#if isStudent}
							<MoneyField label="Studiefinanciering (gift)" bind:value={d.studiefinanciering} hint="Basisbeurs en aanvullende beurs. Dit wordt een gift als je binnen 10 jaar een diploma haalt." />
							<MoneyField label="Lening DUO per maand" bind:value={d.studielening} hint="Dit is geen inkomen maar een schuld; we tellen het wel mee voor je ruimte." />
						{/if}
						<MoneyField label="Toeslagen & kinderbijslag" bind:value={d.toeslagen} hint="Zorg-, huur-, kinderopvangtoeslag, kindgebonden budget, kinderbijslag (omgerekend per maand)." />
						<MoneyField label="Overige inkomsten" bind:value={d.overigeInkomsten} hint="Bijv. verhuur, alimentatie, freelance naast je baan." />
					</div>
				</div>
			{:else if stap === 3}
				<div class="grid gap-4 sm:grid-cols-2">
					<MoneyField label={d.woonsituatie === 'koop' ? 'Hypotheek (bruto rente + aflossing)' : 'Huur'} bind:value={d.woonlasten} hint={d.woonsituatie === 'bij_ouders' ? 'Kostgeld aan je ouders.' : 'Inclusief servicekosten of VvE.'} />
					<MoneyField label="Energie & water" bind:value={d.energieWater} />
					<MoneyField label="Verzekeringen" bind:value={d.verzekeringen} hint="Zorg (premie), aansprakelijkheid, inboedel, opstal, auto." />
					<MoneyField label="Telefoon, internet & abonnementen" bind:value={d.abonnementen} hint="Streaming, sportschool, krant, software." />
					<MoneyField label="Vervoer" bind:value={d.vervoer} hint="OV, brandstof, wegenbelasting, parkeren, onderhoud." />
					<MoneyField label="Aflossingen op schulden" bind:value={d.aflossingen} hint="DUO-termijn, persoonlijke lening, creditcard." />
					<MoneyField label="Kinderopvang, gemeentelijke belastingen & overig" bind:value={d.kinderopvangOverig} />
				</div>
			{:else if stap === 4}
				<div class="grid gap-4 sm:grid-cols-2">
					<MoneyField label="Boodschappen" bind:value={d.boodschappen} />
					<MoneyField label="Uit eten, bezorging & horeca" bind:value={d.horeca} />
					<MoneyField label="Kleding & winkelen" bind:value={d.winkelen} />
					<MoneyField label="Vrije tijd, uitjes & vakantie" bind:value={d.vrijeTijd} hint="Reken een vakantie om naar een maandbedrag." />
					<MoneyField label="Persoonlijke verzorging & gezondheid" bind:value={d.verzorging} />
					<MoneyField label="Overig" bind:value={d.overigVariabel} />
				</div>
			{:else if stap === 5}
				<div class="grid gap-5">
					<div class="grid gap-4 sm:grid-cols-2">
						<MoneyField label="Spaargeld (direct opneembaar)" suffix="€" bind:value={d.spaargeld} />
						<MoneyField label="Beleggingen (niet geïmporteerd)" suffix="€" bind:value={d.beleggingen} hint="Bijv. een indexfonds of pensioenbeleggen dat niet in je portfolio staat." />
					</div>
					{#if $portfolio.hasData}
						<label class="flex items-center gap-3 rounded-lg border border-purple-500/20 bg-purple-950/20 px-4 py-3 text-sm">
							<input type="checkbox" class="size-4 accent-purple-400" bind:checked={d.gebruikPortfolio} />
							Tel mijn geïmporteerde portfolio mee (<b class="num">{euro($portfolio.totalValue + $portfolio.cash)}</b>)
						</label>
					{/if}
					{#if d.woonsituatie === 'koop'}
						<div class="grid gap-4 sm:grid-cols-2">
							<MoneyField label="WOZ- of marktwaarde woning" suffix="€" bind:value={d.woningwaarde} />
							<MoneyField label="Openstaande hypotheek" suffix="€" bind:value={d.hypotheek} />
						</div>
					{/if}
					<div class="grid gap-4 sm:grid-cols-2">
						<MoneyField label="Studieschuld (DUO)" suffix="€" bind:value={d.studieschuld} hint="Zie Mijn DUO voor het actuele bedrag." />
						<MoneyField label="Overige schulden" suffix="€" bind:value={d.overigeSchulden} hint="Creditcard, persoonlijke lening, rood staan, achteraf betalen." />
					</div>
				</div>
			{:else if stap === 6}
				<div class="grid gap-6">
					<div class="grid gap-2">
						<span class="label">Wat is je belangrijkste doel?</span>
						{@render keuze(
							[['buffer', 'Buffer opbouwen'], ['schulden', 'Schulden aflossen'], ['huis', 'Sparen voor een huis'], ['vermogen', 'Vermogen opbouwen'], ['pensioen', 'Aanvullen pensioen'], ['fire', 'Financieel onafhankelijk']],
							d.doel,
							(v) => (d.doel = v)
						)}
					</div>
					<div class="grid gap-4 sm:grid-cols-2">
						<MoneyField label="Over hoeveel jaar heb je dit geld nodig?" suffix="jaar" bind:value={d.horizon} hint="Korter dan 5 jaar? Dan adviseren we sparen in plaats van beleggen." />
						<MoneyField label="Doelbedrag (optioneel)" suffix="€" bind:value={d.doelbedrag} />
					</div>
					<div class="grid gap-2">
						<span class="label">Stel: je beleggingen dalen in een paar maanden 25%. Wat doe je?</span>
						{@render keuze(
							[['verkopen', 'Alles verkopen'], ['deels', 'Een deel verkopen'], ['houden', 'Niets, rustig blijven'], ['bijkopen', 'Juist bijkopen']],
							d.reactieDaling,
							(v) => {
								d.reactieDaling = v;
								d.risico = null;
							}
						)}
					</div>
					<div class="grid gap-2">
						<span class="label">Ervaring met beleggen</span>
						{@render keuze(
							[['geen', 'Geen'], ['beetje', 'Een beetje'], ['ervaren', 'Ervaren']],
							d.ervaring,
							(v) => {
								d.ervaring = v;
								d.risico = null;
							}
						)}
					</div>
					<div class="rounded-lg border border-white/10 bg-white/[0.02] p-4">
						<div class="mb-2 text-sm text-white/60">Je risicoprofiel (aan te passen):</div>
						{@render keuze([['laag', 'Defensief'], ['gemiddeld', 'Neutraal'], ['hoog', 'Offensief']], d.risico ?? afgeleidRisico(d), (v) => (d.risico = v))}
						<p class="mt-2 text-xs text-white/45">Gebaseerd op je horizon, je reactie op een daling en je ervaring, zoals de AFM aanbeveelt bij het bepalen van je risicobereidheid.</p>
					</div>
				</div>
			{/if}

			<!-- live tussenstand -->
			<div class="mt-8 grid grid-cols-3 gap-3 rounded-lg bg-white/[0.03] p-4 text-center text-sm">
				<div><div class="text-xs text-white/45">Inkomen</div><div class="num font-medium">{euro(live.inkomen)}</div></div>
				<div><div class="text-xs text-white/45">Uitgaven</div><div class="num font-medium">{euro(live.uitgaven)}</div></div>
				<div><div class="text-xs text-white/45">Over</div><div class="num font-medium {live.vrijeRuimte >= 0 ? 'pos' : 'neg'}">{euro(live.vrijeRuimte)}</div></div>
			</div>

			<div class="mt-6 flex justify-between">
				<button class="btn btn-ghost" onclick={prev} disabled={stap === 1 && !$rapport.savedAt}>Terug</button>
				<button class="btn btn-primary" onclick={next}>{stap === 6 ? 'Rapport bekijken' : 'Volgende'} <Icon name="arrowright" /></button>
			</div>
		</div>
	</div>
{:else if saved}
	<!-- ───────────── RESULTATEN ───────────── -->
	<header class="mb-8 flex flex-wrap items-end justify-between gap-4">
		<div>
			<a href="{base}/rapport/" class="mb-2 inline-flex items-center gap-1 text-xs text-white/45 hover:text-white">← Alle rapporten</a>
			<p class="text-sm text-purple-300">Algemeen rapport · {dateNl($rapport.savedAt!)}</p>
			<h1 class="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Jouw financiële foto</h1>
		</div>
		<div class="flex gap-2">
			<button class="btn btn-ghost" onclick={() => edit(1)}>Aanpassen</button>
			<button class="btn btn-danger" onclick={remove}><Icon name="trash" /></button>
		</div>
	</header>

	<section class="mb-6 grid gap-4 lg:grid-cols-4">
		<div class="card flex items-center gap-5 lg:col-span-1">
			<svg viewBox="0 0 36 36" class="size-24 shrink-0 -rotate-90" aria-label="Score {saved.score} van 100">
				<circle cx="18" cy="18" r="15.9" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="3" />
				<circle cx="18" cy="18" r="15.9" fill="none" stroke={scoreColor(saved.score)} stroke-width="3" stroke-linecap="round" stroke-dasharray="{saved.score} 100" />
			</svg>
			<div>
				<div class="num text-3xl font-bold">{saved.score}</div>
				<div class="text-sm text-white/60">{saved.scoreLabel}</div>
				<div class="text-xs text-white/35">financiële gezondheid</div>
			</div>
		</div>
		<div class="card lg:col-span-3">
			<div class="grid gap-4 sm:grid-cols-4">
				<div><div class="card-title">Inkomen</div><div class="num text-xl font-semibold">{euro(saved.inkomen)}</div></div>
				<div><div class="card-title">Uitgaven</div><div class="num text-xl font-semibold">{euro(saved.uitgaven)}</div><div class="text-xs text-white/40">{euro(saved.vasteLasten)} vast</div></div>
				<div><div class="card-title">Vrije ruimte</div><div class="num text-xl font-semibold {saved.vrijeRuimte >= 0 ? 'pos' : 'neg'}">{euro(saved.vrijeRuimte)}</div><div class="text-xs text-white/40">{pct(saved.spaarquote * 100, 0, false)} van inkomen</div></div>
				<div><div class="card-title">Woonquote</div><div class="num text-xl font-semibold">{pct(saved.woonquote * 100, 0, false)}</div><div class="text-xs text-white/40">van je inkomen</div></div>
			</div>
			<div class="mt-5">
				<div class="mb-1.5 flex justify-between text-xs text-white/55">
					<span>Buffer: <b class="num text-white/85">{euro(saved.buffer.huidig)}</b> van ± {euro(saved.buffer.advies)}</span>
					<span>{saved.buffer.status === 'te_laag' ? (saved.buffer.maandenTotVol ? `nog ± ${saved.buffer.maandenTotVol} mnd` : 'te laag') : saved.buffer.status === 'ruim' ? 'ruim op peil' : 'op peil'}</span>
				</div>
				<div class="h-2 overflow-hidden rounded-full bg-white/10">
					<div class="h-full rounded-full {saved.buffer.status === 'te_laag' ? 'bg-yellow-400' : 'bg-emerald-400'}" style="width:{Math.min(100, (saved.buffer.huidig / Math.max(1, saved.buffer.advies)) * 100)}%"></div>
				</div>
				<a class="mt-1 inline-block text-xs text-white/40 underline" href={BRONNEN.nibudBuffer.url} target="_blank" rel="noopener">Indicatie o.b.v. Nibud-uitgangspunten · maak je eigen berekening</a>
			</div>
		</div>
	</section>

	{#if saved.waarschuwingen.length}
		<section class="mb-6 grid gap-2">
			{#each saved.waarschuwingen as w (w)}
				<div class="flex items-start gap-3 rounded-lg border border-yellow-500/20 bg-yellow-950/20 px-4 py-3 text-sm text-yellow-100"><Icon name="alert" class="mt-0.5 size-4 shrink-0" /><span>{w}</span></div>
			{/each}
		</section>
	{/if}

	<section class="card mb-6">
		<h2 class="mb-1 text-lg font-semibold">Hoe sta jij ervoor ten opzichte van leeftijdsgenoten?</h2>
		<p class="mb-5 text-sm text-white/50">Je vermogen naast het gemiddelde en de mediaan van Nederlandse huishoudens per leeftijd, met waar je naartoe groeit als je je plan volhoudt.</p>
		<WealthCompare res={saved} />
	</section>

	<section class="mb-6 grid gap-4 lg:grid-cols-3">
		<div class="card">
			<h2 class="card-title mb-3">Jouw maandplan (indicatie)</h2>
			<div class="space-y-3">
				<div class="flex items-center justify-between rounded-lg bg-white/[0.03] px-4 py-3"><span class="text-sm text-white/70">Sparen</span><span class="num font-semibold">{euro(saved.maandSparen)}</span></div>
				<div class="flex items-center justify-between rounded-lg border border-purple-500/25 bg-purple-950/30 px-4 py-3"><span class="text-sm text-purple-100">Beleggen</span><span class="num font-semibold text-purple-200">{euro(saved.maandBeleggen)}</span></div>
				<div class="text-xs text-white/45">Risicoprofiel <b class="text-white/70">{saved.risico === 'laag' ? 'defensief' : saved.risico === 'gemiddeld' ? 'neutraal' : 'offensief'}</b>: {saved.verdeling.aandelen}% aandelen / {saved.verdeling.obligaties}% obligaties.</div>
			</div>
		</div>
		<div class="card lg:col-span-2">
			<h2 class="card-title mb-3">Vervolgstappen</h2>
			<ul class="space-y-4">
				{#each saved.tips as t (t.titel)}
					<li>
						<div class="font-medium text-white">{t.titel}</div>
						<p class="mt-0.5 text-sm text-white/65">{t.tekst}</p>
						<div class="mt-1 flex flex-wrap gap-x-3 gap-y-1">
							{#each t.links as l (l.url)}<a class="inline-flex items-center gap-1 text-xs text-purple-300 hover:underline" href={l.url} target="_blank" rel="noopener">{l.label} <Icon name="external" class="size-3" /></a>{/each}
						</div>
					</li>
				{:else}
					<li class="text-sm text-white/50">Goed bezig, geen acties nodig.</li>
				{/each}
			</ul>
		</div>
	</section>

	{#if saved.etfs.length}
		<section class="card mb-6">
			<h2 class="mb-1 text-lg font-semibold">Fondsen om te onderzoeken</h2>
			<p class="mb-4 text-sm text-white/50">Breed gespreide, goedkope indexfondsen die passen bij profiel "{saved.risico}". Geen advies: vergelijk zelf kosten, beurs en broker.</p>
			<div class="grid gap-3 md:grid-cols-3">
				{#each saved.etfs as e (e.isin)}
					<a href={e.url} target="_blank" rel="noopener" class="group rounded-xl border border-white/10 bg-white/[0.02] p-4 transition-colors hover:border-purple-500/40">
						<div class="flex items-center justify-between">
							<span class="font-mono text-sm text-purple-200">{e.ticker}</span>
							<span class="chip">{e.soort} · TER {e.ter}</span>
						</div>
						<div class="mt-2 font-medium text-white">{e.naam}</div>
						<p class="mt-1 text-sm text-white/60">{e.waarom}</p>
						<div class="mt-2 font-mono text-xs text-white/35">{e.isin}</div>
					</a>
				{/each}
			</div>
			<p class="mt-4 text-xs text-white/40">
				Waarom indexfondsen? Uit het <a class="underline" href={BRONNEN.spiva.url} target="_blank" rel="noopener">SPIVA-onderzoek van S&P</a> blijkt dat het merendeel van actief beheerde aandelenfondsen over 10+ jaar achterblijft bij hun index. Lees ook <a class="underline" href={BRONNEN.afm.url} target="_blank" rel="noopener">de AFM over beleggen</a>. Beleggen brengt risico's met zich mee: je kunt (een deel van) je inleg verliezen.
			</p>
		</section>
	{/if}

	<p class="text-xs text-white/35">Dit rapport is een educatieve indicatie op basis van jouw invoer, geen persoonlijk financieel advies. Twijfel je over grote beslissingen, neem dan contact op met een onafhankelijk financieel adviseur.</p>
{/if}
