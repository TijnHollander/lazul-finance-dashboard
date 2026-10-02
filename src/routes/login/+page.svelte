<script lang="ts">
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import Particles from '$lib/components/Particles.svelte';
	import TickerTape from '$lib/components/TickerTape.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import { profile, unlocked } from '$lib/stores';
	import { hashPin } from '$lib/auth';
	import { wipeAll } from '$lib/storage';

	const mode = $derived($profile ? 'login' : 'register');
	let name = $state('');
	let birthYear = $state<number | null>(null);
	let pin = $state('');
	let pinVisible = $state(false);
	let error = $state<string | null>(null);
	let loading = $state(false);

	async function submit(e: Event) {
		e.preventDefault();
		error = null;
		loading = true;
		try {
			if (mode === 'register') {
				if (!name.trim()) throw new Error('Vul je naam in.');
				const year = new Date().getFullYear();
				if (birthYear != null && (birthYear < year - 110 || birthYear > year - 12)) throw new Error('Controleer je geboortejaar.');
				if (pin && !/^\d{4,8}$/.test(pin)) throw new Error('Een pincode bestaat uit 4 tot 8 cijfers.');
				profile.set({ name: name.trim(), birthYear, pinHash: pin ? await hashPin(pin) : null, createdAt: new Date().toISOString() });
				unlocked.set(true);
				goto(`${base}/`);
			} else {
				if ($profile?.pinHash && (await hashPin(pin)) !== $profile.pinHash) throw new Error('Onjuiste pincode.');
				unlocked.set(true);
				goto(`${base}/`);
			}
		} catch (err) {
			error = (err as Error).message;
		}
		loading = false;
	}

	function reset() {
		if (confirm('Weet je het zeker? Alle Lazul-gegevens op dit apparaat worden gewist.')) {
			wipeAll();
			location.reload();
		}
	}
</script>

<svelte:head><title>{mode === 'register' ? 'Welkom' : 'Inloggen'} · Lazul Finance</title></svelte:head>

<div class="relative flex min-h-screen w-full flex-col overflow-y-hidden bg-black">
	<TickerTape />
	<div class="relative flex w-full flex-1 items-center justify-center px-4 py-10">
		<div class="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(147,51,234,0.18),transparent_50%)]"></div>
		<div class="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(99,33,160,0.12),transparent_35%)]"></div>
		<Particles quantity={120} staticity={40} ease={50} color="#ffffff" />

		<div class="glass relative z-10 flex w-full max-w-md flex-col gap-6 p-8">
			<div class="flex flex-col items-center gap-1 text-center">
				<img src="{base}/favicon.svg" alt="" class="mb-3 size-11" />
				{#if mode === 'register'}
					<h1 class="text-2xl font-bold text-white">Welkom bij Lazul Finance</h1>
					<p class="text-sm text-white/50">Maak een lokaal profiel aan. Je gegevens blijven in deze browser en gaan nergens naartoe.</p>
				{:else}
					<h1 class="text-2xl font-bold text-white">Welkom terug, {$profile?.name}</h1>
					<p class="text-sm text-white/50">Voer je pincode in om je dashboard te openen.</p>
				{/if}
			</div>

			<form class="flex flex-col gap-4" onsubmit={submit}>
				{#if mode === 'register'}
					<div class="grid gap-2">
						<label class="label" for="name">Naam <span class="text-red-500">*</span></label>
						<input id="name" class="input" placeholder="Je voornaam" bind:value={name} autocomplete="given-name" />
					</div>
					<div class="grid gap-2">
						<label class="label" for="by">Geboortejaar</label>
						<input id="by" class="input" type="number" inputmode="numeric" placeholder="bijv. 1998" bind:value={birthYear} />
						<span class="hint">Gebruikt om je vermogen te vergelijken met leeftijdsgenoten (CBS).</span>
					</div>
				{/if}
				{#if mode === 'register' || $profile?.pinHash}
					<div class="grid gap-2">
						<label class="label" for="pin">Pincode {mode === 'register' ? '(optioneel)' : ''}</label>
						<div class="relative">
							<input
								id="pin"
								class="input pr-12"
								type={pinVisible ? 'text' : 'password'}
								inputmode="numeric"
								autocomplete={mode === 'register' ? 'new-password' : 'current-password'}
								placeholder="4–8 cijfers"
								bind:value={pin}
							/>
							<button type="button" class="absolute top-1/2 right-1 -translate-y-1/2 rounded-md p-2 text-white/50 hover:text-white" aria-label="Pincode tonen" onclick={() => (pinVisible = !pinVisible)}>
								<Icon name={pinVisible ? 'eyeoff' : 'eye'} />
							</button>
						</div>
						{#if mode === 'register'}<span class="hint">Schermt je dashboard af op een gedeeld apparaat.</span>{/if}
					</div>
				{/if}

				{#if error}<p class="text-sm text-red-400">{error}</p>{/if}

				<button type="submit" class="btn btn-primary mt-8 w-full p-3" disabled={loading}>
					{#if loading}Bezig…{:else if mode === 'register'}Profiel aanmaken{:else}Inloggen{/if}
				</button>
			</form>

			<div class="flex flex-col items-center gap-3 text-sm text-white/60">
				{#if mode === 'login'}
					<p>Pincode vergeten? <button class="text-white underline underline-offset-2" onclick={reset}>Begin opnieuw</button></p>
				{:else}
					<p class="text-center text-xs text-white/40">Geen account, geen server, geen tracking. Maak in Instellingen een back-up om je data mee te nemen.</p>
				{/if}
			</div>
		</div>
	</div>
</div>
