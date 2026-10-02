<script lang="ts">
	import { onMount } from 'svelte';
	import Icon from '$lib/components/Icon.svelte';
	import { profile, settings, quotes } from '$lib/stores';
	import { exportAll, importAll, wipeAll } from '$lib/storage';
	import { hashPin } from '$lib/auth';
	import { provider, resetProvider, fetchQuotes, type Provider } from '$lib/market';

	let prov = $state<Provider>('none');
	let newPin = $state('');
	let msg = $state<string | null>(null);
	let keyDraft = $state($settings.finnhubKey);
	onMount(async () => (prov = await provider()));

	function flash(m: string) {
		msg = m;
		setTimeout(() => (msg = null), 3500);
	}

	async function saveKey() {
		settings.update((s) => ({ ...s, finnhubKey: keyDraft.trim() }));
		resetProvider();
		quotes.set({});
		prov = await provider();
		if (prov === 'finnhub') {
			const r = await fetchQuotes(['AAPL'], { maxAgeMs: 0 });
			flash(r.AAPL && !r.AAPL.error ? 'Finnhub-sleutel werkt.' : 'Sleutel opgeslagen, maar test-koers mislukte. Controleer de sleutel.');
		} else flash('Opgeslagen.');
	}

	async function changePin() {
		if (newPin && !/^\d{4,8}$/.test(newPin)) return flash('Pincode moet 4–8 cijfers zijn.');
		const pinHash = newPin ? await hashPin(newPin) : null;
		profile.update((p) => (p ? { ...p, pinHash } : p));
		newPin = '';
		flash(pinHash ? 'Pincode ingesteld.' : 'Pincode verwijderd.');
	}

	function download() {
		const blob = new Blob([JSON.stringify({ app: 'lazul-finance', version: 1, exportedAt: new Date().toISOString(), data: exportAll() }, null, 2)], { type: 'application/json' });
		const a = document.createElement('a');
		a.href = URL.createObjectURL(blob);
		a.download = `lazul-backup-${new Date().toISOString().slice(0, 10)}.json`;
		a.click();
		URL.revokeObjectURL(a.href);
	}

	async function restore(e: Event) {
		const f = (e.target as HTMLInputElement).files?.[0];
		if (!f) return;
		try {
			const j = JSON.parse(await f.text());
			if (j.app !== 'lazul-finance' || !j.data) throw new Error();
			if (!confirm('Back-up terugzetten? Huidige gegevens worden overschreven.')) return;
			importAll(j.data);
			location.reload();
		} catch {
			flash('Dit is geen geldige Lazul-back-up.');
		}
	}

	function wipe() {
		if (confirm('Alles wissen? Profiel, portfolio, transacties en rapport worden van dit apparaat verwijderd.')) {
			wipeAll();
			location.reload();
		}
	}
</script>

<svelte:head><title>Instellingen · Lazul Finance</title></svelte:head>

<header class="mb-8">
	<h1 class="text-2xl font-bold tracking-tight sm:text-3xl">Instellingen</h1>
	<p class="mt-1 text-sm text-white/50">Alles wat je hier instelt, blijft op dit apparaat.</p>
</header>

{#if msg}<div class="mb-4 rounded-lg border border-purple-500/20 bg-purple-950/30 px-4 py-2 text-sm text-purple-200">{msg}</div>{/if}

<div class="grid max-w-3xl gap-6">
	<section class="card">
		<h2 class="mb-4 font-semibold">Profiel</h2>
		{#if $profile}
			<div class="grid gap-4 sm:grid-cols-2">
				<label class="grid gap-1.5"><span class="label">Naam</span><input class="input" bind:value={$profile.name} /></label>
				<label class="grid gap-1.5"><span class="label">Geboortejaar</span><input class="input" type="number" bind:value={$profile.birthYear} /></label>
			</div>
			<div class="mt-4 grid gap-1.5">
				<span class="label">Pincode {$profile.pinHash ? '(ingesteld)' : '(geen)'}</span>
				<div class="flex gap-2">
					<input class="input" type="password" inputmode="numeric" placeholder={$profile.pinHash ? 'Nieuwe pincode, leeg = verwijderen' : '4–8 cijfers'} bind:value={newPin} />
					<button class="btn btn-primary shrink-0" onclick={changePin}>Opslaan</button>
				</div>
				<span class="hint">De pincode schermt je dashboard af op een gedeeld apparaat. Het is geen versleuteling.</span>
			</div>
		{/if}
	</section>

	<section class="card">
		<div class="mb-4 flex items-center justify-between">
			<h2 class="font-semibold">Koersen & nieuws</h2>
			<span class="chip {prov === 'none' ? 'text-yellow-200' : 'text-emerald-300'}">
				{prov === 'api' ? 'Ingebouwde API (Yahoo Finance + RSS)' : prov === 'finnhub' ? 'Finnhub' : 'Geen bron actief'}
			</span>
		</div>
		<p class="mb-4 text-sm text-white/60">
			Op <b class="text-white/80">Vercel</b> haalt de app koersen en nieuws op via de meegeleverde functies, zonder sleutel. Op <b class="text-white/80">GitHub Pages</b> (alleen statisch) is een gratis
			<a class="underline" href="https://finnhub.io/register" target="_blank" rel="noopener">Finnhub-sleutel</a> nodig.
		</p>
		<label class="grid gap-1.5">
			<span class="label">Finnhub API-sleutel</span>
			<div class="flex gap-2">
				<input class="input font-mono" placeholder="bijv. cq1abc…" bind:value={keyDraft} autocomplete="off" />
				<button class="btn btn-primary shrink-0" onclick={saveKey}>Opslaan & testen</button>
			</div>
			<span class="hint">De sleutel wordt alleen in deze browser bewaard en direct naar Finnhub gestuurd.</span>
		</label>
	</section>

	<section class="card">
		<h2 class="mb-4 font-semibold">Aannames voor projecties</h2>
		<div class="grid gap-4 sm:grid-cols-3">
			<label class="grid gap-1.5"><span class="label">Rendement beleggen</span><div class="relative"><input class="input pr-8" type="number" step="0.5" bind:value={$settings.expectedReturn} /><span class="absolute top-1/2 right-3 -translate-y-1/2 text-xs text-white/40">%</span></div><span class="hint">Lange termijn wereldwijd aandelen: ± 6–7%.</span></label>
			<label class="grid gap-1.5"><span class="label">Spaarrente</span><div class="relative"><input class="input pr-8" type="number" step="0.25" bind:value={$settings.savingsRate} /><span class="absolute top-1/2 right-3 -translate-y-1/2 text-xs text-white/40">%</span></div></label>
			<label class="grid gap-1.5"><span class="label">Inflatie</span><div class="relative"><input class="input pr-8" type="number" step="0.25" bind:value={$settings.inflation} /><span class="absolute top-1/2 right-3 -translate-y-1/2 text-xs text-white/40">%</span></div><span class="hint">Projecties tonen bedragen in euro's van nu.</span></label>
		</div>
	</section>

	<section class="card">
		<h2 class="mb-2 font-semibold">Back-up</h2>
		<p class="mb-4 text-sm text-white/60">Omdat er geen server is, staat je data alleen in deze browser. Maak een back-up om over te stappen naar een ander apparaat of browser.</p>
		<div class="flex flex-wrap gap-2">
			<button class="btn btn-primary" onclick={download}><Icon name="upload" class="size-4 rotate-180" /> Back-up downloaden</button>
			<label class="btn btn-ghost">
				<Icon name="upload" /> Back-up terugzetten
				<input type="file" accept="application/json,.json" class="hidden" onchange={restore} />
			</label>
		</div>
	</section>

	<section class="card border-red-500/20">
		<h2 class="mb-2 font-semibold text-red-200">Alles wissen</h2>
		<p class="mb-4 text-sm text-white/60">Verwijdert je profiel en alle gegevens van dit apparaat.</p>
		<button class="btn btn-danger" onclick={wipe}><Icon name="trash" /> Alles wissen</button>
	</section>
</div>
