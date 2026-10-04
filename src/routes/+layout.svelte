<script lang="ts">
	import '../app.css';
	import type { Snippet } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { profile, unlocked, settings } from '$lib/stores';
	import { fetchFx } from '$lib/market';
	import { startAutoRefresh } from '$lib/live';
	import Icon from '$lib/components/Icon.svelte';
	import TickerTape from '$lib/components/TickerTape.svelte';
	import Particles from '$lib/components/Particles.svelte';

	let { children }: { children: Snippet } = $props();

	const isLogin = $derived(page.url.pathname.replace(base, '').startsWith('/login'));
	const allowed = $derived(!!$profile && (!$profile.pinHash || $unlocked));
	let menuOpen = $state(false);

	$effect(() => {
		if (!isLogin && !allowed) goto(`${base}/login/`, { replaceState: true });
	});

	$effect(() => {
		if (allowed && !isLogin) {
			fetchFx();
			startAutoRefresh();
		}
	});

	const nav = [
		{ href: '/', label: 'Overzicht', icon: 'home' },
		{ href: '/portfolio/', label: 'Portfolio', icon: 'pie' },
		{ href: '/uitgaven/', label: 'Uitgaven & inkomsten', icon: 'wallet' },
		{ href: '/rapport/', label: 'Rapport', icon: 'report' },
		{ href: '/markt/', label: 'Markt', icon: 'chart' },
		{ href: '/nieuws/', label: 'Nieuws', icon: 'news' },
		{ href: '/instellingen/', label: 'Instellingen', icon: 'settings' }
	];
	const current = $derived(page.url.pathname.replace(base, '') || '/');
	const active = (href: string) => (href === '/' ? current === '/' : current.startsWith(href));

	function lock() {
		unlocked.set(false);
		goto(`${base}/login/`);
	}
</script>

{#if isLogin}
	{@render children()}
{:else if allowed}
	<div class="min-h-screen bg-black text-white {$settings.hideAmounts ? 'privacy' : ''}">
		<div class="pointer-events-none fixed inset-0 bg-glow"></div>
		<div class="pointer-events-none fixed inset-0 opacity-60"><Particles quantity={50} staticity={60} ease={60} color="#ffffff" /></div>

		<!-- zijbalk -->
		<aside
			class="fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-white/10 bg-black/70 backdrop-blur-xl transition-transform lg:translate-x-0 {menuOpen ? 'translate-x-0' : '-translate-x-full'}"
		>
			<a href="{base}/" class="flex items-center gap-3 px-6 py-6" onclick={() => (menuOpen = false)}>
				<img src="{base}/favicon.svg" alt="" class="size-8" />
				<div>
					<div class="text-base font-semibold tracking-tight">Lazul Finance</div>
					<div class="text-xs text-white/40">Jouw geld, lokaal</div>
				</div>
			</a>
			<nav class="flex flex-1 flex-col gap-1 px-3">
				{#each nav as item (item.href)}
					<a
						href="{base}{item.href}"
						onclick={() => (menuOpen = false)}
						class="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors {active(item.href)
							? 'border border-purple-500/30 bg-purple-950/40 text-purple-200'
							: 'border border-transparent text-white/60 hover:bg-white/[0.04] hover:text-white'}"
					>
						<Icon name={item.icon} class="size-[18px]" />
						{item.label}
					</a>
				{/each}
			</nav>
			<div class="border-t border-white/10 p-4">
				<div class="flex items-center gap-3">
					<div class="grid size-9 place-items-center rounded-full border border-purple-500/30 bg-purple-950/50 text-sm font-semibold text-purple-200">
						{($profile?.name ?? '?').slice(0, 1).toUpperCase()}
					</div>
					<div class="min-w-0 flex-1">
						<div class="truncate text-sm font-medium">{$profile?.name}</div>
						<div class="text-xs text-white/40">Data blijft op dit apparaat</div>
					</div>
					<button class="rounded-md p-2 text-white/50 hover:bg-white/5 hover:text-white" title="Bedragen verbergen" aria-label="Bedragen verbergen" onclick={() => settings.update((s) => ({ ...s, hideAmounts: !s.hideAmounts }))}>
						<Icon name={$settings.hideAmounts ? 'eyeoff' : 'eye'} />
					</button>
					{#if $profile?.pinHash}
						<button class="rounded-md p-2 text-white/50 hover:bg-white/5 hover:text-white" title="Vergrendelen" aria-label="Vergrendelen" onclick={lock}>
							<Icon name="lock" />
						</button>
					{/if}
				</div>
			</div>
		</aside>
		{#if menuOpen}
			<button class="fixed inset-0 z-30 bg-black/60 lg:hidden" aria-label="Menu sluiten" onclick={() => (menuOpen = false)}></button>
		{/if}

		<div class="relative lg:pl-64">
			<div class="sticky top-0 z-20">
				<div class="flex items-center gap-3 border-b border-white/5 bg-black/70 px-4 py-3 backdrop-blur lg:hidden">
					<button class="rounded-md p-1.5 text-white/70 hover:bg-white/5" aria-label="Menu openen" onclick={() => (menuOpen = true)}><Icon name="menu" class="size-5" /></button>
					<span class="font-semibold">Lazul Finance</span>
				</div>
				<TickerTape />
			</div>
			<main class="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
				{@render children()}
			</main>
		</div>
	</div>
{/if}

<style>
	:global(.privacy .num) {
		filter: blur(7px);
		transition: filter 0.2s;
	}
	:global(.privacy .num:hover) {
		filter: none;
	}
</style>
