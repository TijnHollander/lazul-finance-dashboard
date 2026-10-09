<script lang="ts">
	import ReportHeader from '$lib/components/ReportHeader.svelte';
	import MoneyField from '$lib/components/MoneyField.svelte';
	import Choice from '$lib/components/Choice.svelte';
	import Toggle from '$lib/components/Toggle.svelte';
	import TipList from '$lib/components/TipList.svelte';
	import { belastingRapport } from '$lib/stores';
	import { berekenBelasting, emptyBelasting, type BelastingData } from '$lib/reports/belasting';
	import { BOX3 } from '$lib/reports/fiscaal2026';
	import { bekend } from '$lib/reports/prefill';
	import { autosave } from '$lib/reports/autosave';
	import { euro } from '$lib/format';

	const k = bekend();
	const start = (): BelastingData => ({
		...emptyBelasting(),
		werkstatus: k.werkstatus === 'zelfstandig' ? 'zzp' : k.werkstatus === 'student' ? 'student' : k.werkstatus === 'pensioen' ? 'pensioen' : 'loondienst',
		partner: k.samenwonend,
		kinderen: k.kinderen,
		woonsituatie: k.woonsituatie === 'koop' ? 'koop' : k.woonsituatie === 'bij_ouders' ? 'bij_ouders' : 'huur',
		woz: k.woningwaarde,
		eigenwoningschuld: k.hypotheek,
		spaargeld: k.spaargeld,
		beleggingen: k.beleggingen,
		studieschuld: k.studieschuld,
		schuldenBox3: (k.studieschuld ?? 0) + (k.overigeSchulden ?? 0) || null
	});
	let d = $state<BelastingData>(structuredClone($belastingRapport.data ?? start()));
	const save = autosave(belastingRapport, () => $state.snapshot(d) as BelastingData, !!$belastingRapport.savedAt);
	$effect(() => {
		JSON.stringify(d);
		save();
	});
	const r = $derived(berekenBelasting(d));
	function reset() {
		if (confirm('Dit rapport leegmaken?')) {
			d = start();
			belastingRapport.set({ data: null, savedAt: null });
		}
	}
</script>

<svelte:head><title>Belastingvoordelen · Lazul Finance</title></svelte:head>

<ReportHeader titel="Belastingvoordelen" intro="Welke aftrekposten, vrijstellingen en regelingen laat je liggen? Met de bedragen en tarieven van 2026." savedAt={$belastingRapport.savedAt} onreset={reset} />

<div class="grid gap-6 lg:grid-cols-5">
	<div class="glass space-y-6 p-6 lg:col-span-3">
		<section class="grid gap-4">
			<h2 class="font-semibold">Werk & inkomen</h2>
			<Choice options={[['loondienst', 'Loondienst'], ['zzp', 'Zzp / ondernemer'], ['student', 'Student'], ['pensioen', 'Gepensioneerd'], ['anders', 'Anders']]} bind:value={d.werkstatus} />
			<div class="grid gap-4 sm:grid-cols-2">
				<MoneyField label={d.werkstatus === 'zzp' ? 'Winst uit onderneming' : 'Bruto jaarinkomen'} suffix="€ / jaar" bind:value={d.brutoInkomen} />
				{#if d.werkstatus === 'loondienst'}<div class="self-end"><Toggle label="Ik bouw pensioen op via mijn werkgever" bind:checked={d.pensioenWerkgever} /></div>{/if}
				{#if d.werkstatus === 'zzp'}
					<MoneyField label="Uren aan je bedrijf per jaar" suffix="uur" bind:value={d.zzpUren} />
					<div class="self-end"><Toggle label="Ik ben starter (≤ 5 jaar ondernemer)" bind:checked={d.zzpStarter} /></div>
				{/if}
				<MoneyField label="Inleg lijfrente / banksparen per jaar" suffix="€ / jaar" bind:value={d.lijfrenteInleg} />
			</div>
		</section>

		<section class="grid gap-3">
			<h2 class="font-semibold">Huishouden</h2>
			<div class="grid gap-3 sm:grid-cols-2">
				<Toggle label="Ik heb een fiscaal partner" bind:checked={d.partner} />
				<Toggle label="Ik ontvang toeslagen" hint="Zorg-, huur- of kinderopvangtoeslag" bind:checked={d.ontvangtToeslagen} />
				<div class="grid gap-1.5"><span class="label">Aantal kinderen</span><input class="input" type="number" min="0" bind:value={d.kinderen} /></div>
				{#if d.kinderen > 0}<div class="self-end"><Toggle label="Er is een kind van 18 of ouder" bind:checked={d.kind18plus} /></div>{/if}
			</div>
		</section>

		<section class="grid gap-4">
			<h2 class="font-semibold">Wonen</h2>
			<Choice options={[['huur', 'Huur'], ['koop', 'Koop'], ['bij_ouders', 'Bij ouders']]} bind:value={d.woonsituatie} />
			{#if d.woonsituatie === 'koop'}
				<div class="grid gap-4 sm:grid-cols-2">
					<MoneyField label="Betaalde hypotheekrente per jaar" suffix="€ / jaar" bind:value={d.hypotheekRenteJaar} hint="Staat op de jaaropgave van je bank." />
					<MoneyField label="WOZ-waarde" suffix="€" bind:value={d.woz} />
					<MoneyField label="Eigenwoningschuld" suffix="€" bind:value={d.eigenwoningschuld} />
					<div class="grid gap-1.5">
						<span class="label">Energielabel</span>
						<Choice size="sm" options={[['A+', 'A+'], ['A', 'A'], ['B', 'B'], ['C', 'C'], ['D', 'D'], ['EFG', 'E–G']]} bind:value={d.energielabel} />
					</div>
				</div>
			{/if}
		</section>

		<section class="grid gap-4 sm:grid-cols-2">
			<h2 class="font-semibold sm:col-span-2">Vermogen (box 3, stand 1 januari)</h2>
			<MoneyField label="Spaargeld" suffix="€" bind:value={d.spaargeld} />
			<MoneyField label="Beleggingen" suffix="€" bind:value={d.beleggingen} />
			<MoneyField label="Waarvan groene beleggingen" suffix="€" bind:value={d.groeneBeleggingen} />
			<MoneyField label="Schulden (excl. hypotheek)" suffix="€" bind:value={d.schuldenBox3} hint="Inclusief studieschuld." />
			<MoneyField label="Waarvan studieschuld" suffix="€" bind:value={d.studieschuld} />
		</section>

		<section class="grid gap-4 sm:grid-cols-2">
			<h2 class="font-semibold sm:col-span-2">Geven & schenken</h2>
			<MoneyField label="Giften aan goede doelen (ANBI)" suffix="€ / jaar" bind:value={d.giftenJaar} />
			<div class="self-end"><Toggle label="Dit is al een periodieke gift (5 jaar vast)" bind:checked={d.periodiekeGift} /></div>
			{#if d.kinderen > 0}<Toggle label="Ik wil schenken aan mijn kinderen" bind:checked={d.wilSchenkenAanKind} />{/if}
		</section>
	</div>

	<aside class="space-y-4 lg:sticky lg:top-16 lg:col-span-2 lg:self-start">
		<div class="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-5">
			<div class="text-xs text-emerald-200/80">Geschat voordeel dat je kunt pakken</div>
			<div class="num mt-1 text-3xl font-bold text-emerald-200">{euro(r.totaalVoordeel)} <span class="text-base font-medium">per jaar</span></div>
			<div class="mt-1 text-sm text-emerald-100/70">Je marginale tarief: {(r.marginaal * 100).toFixed(2).replace('.', ',')}%</div>
		</div>
		<div class="card text-sm">
			<div class="mb-2 font-medium">Box 3 in 2026</div>
			<div class="flex justify-between"><span class="text-white/55">Heffingsvrij vermogen</span><span class="num">{euro(r.box3.vrijstelling)}</span></div>
			<div class="flex justify-between"><span class="text-white/55">Grondslag boven vrijstelling</span><span class="num">{euro(r.box3.grondslag)}</span></div>
			<div class="flex justify-between"><span class="text-white/55">Geschatte box 3-belasting</span><span class="num font-semibold">{euro(r.box3.belasting)}</span></div>
			<p class="mt-2 text-xs text-white/40">Forfaitair rendement: sparen {(BOX3.rendSparen * 100).toFixed(2).replace('.', ',')}%, beleggen {BOX3.rendBeleggen * 100}%, tarief {BOX3.tarief * 100}%. Bij lager werkelijk rendement kun je tegenbewijs leveren.</p>
		</div>
	</aside>
</div>

<section class="card mt-6">
	<h2 class="mb-4 font-semibold">Jouw belastingtips ({r.tips.length})</h2>
	<TipList tips={r.tips} />
</section>
<p class="mt-6 text-xs text-white/35">Schattingen op basis van de tarieven en bedragen van 2026, zonder heffingskortingen. Voor je eigen situatie: belastingdienst.nl of een belastingadviseur.</p>
