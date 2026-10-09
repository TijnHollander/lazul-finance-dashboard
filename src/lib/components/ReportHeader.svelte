<script lang="ts">
	import { base } from '$app/paths';
	import { dateNl } from '$lib/format';
	let { titel, intro, savedAt = null, onreset }: { titel: string; intro: string; savedAt?: string | null; onreset?: () => void } = $props();
</script>

<header class="mb-8">
	<a href="{base}/rapport/" class="mb-2 inline-flex items-center gap-1 text-xs text-white/45 hover:text-white">← Alle rapporten</a>
	<div class="flex flex-wrap items-end justify-between gap-4">
		<div class="max-w-2xl">
			<h1 class="text-2xl font-bold tracking-tight sm:text-3xl">{titel}</h1>
			<p class="mt-1 text-sm text-white/50">{intro}</p>
		</div>
		<div class="flex items-center gap-3 text-xs text-white/40">
			{#if savedAt}<span>Automatisch opgeslagen · {dateNl(savedAt)}</span>{/if}
			{#if onreset}<button class="btn btn-ghost px-3 py-1.5 text-xs" onclick={onreset}>Opnieuw beginnen</button>{/if}
		</div>
	</div>
</header>
