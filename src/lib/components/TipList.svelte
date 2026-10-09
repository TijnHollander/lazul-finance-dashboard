<script lang="ts">
	import Icon from './Icon.svelte';
	import type { Tip } from '$lib/reports/types';
	let { tips }: { tips: Tip[] } = $props();
	const dot = { hoog: 'bg-orange-400', gemiddeld: 'bg-purple-400', laag: 'bg-white/30' };
	const lbl = { hoog: 'Belangrijk', gemiddeld: 'Aanrader', laag: 'Goed om te weten' };
</script>

<ul class="space-y-4">
	{#each tips as t (t.titel)}
		<li class="flex gap-3">
			<span class="mt-1.5 size-2 shrink-0 rounded-full {dot[t.prioriteit]}" title={lbl[t.prioriteit]}></span>
			<div class="min-w-0">
				<div class="font-medium text-white">{t.titel}</div>
				<p class="mt-0.5 text-sm text-white/65">{t.tekst}</p>
				{#if t.voordeel}<div class="mt-1 text-xs font-medium text-emerald-300">{t.voordeel}</div>{/if}
				{#if t.links.length}
					<div class="mt-1 flex flex-wrap gap-x-3 gap-y-1">
						{#each t.links as l (l.url)}<a class="inline-flex items-center gap-1 text-xs text-purple-300 hover:underline" href={l.url} target="_blank" rel="noopener">{l.label} <Icon name="external" class="size-3" /></a>{/each}
					</div>
				{/if}
			</div>
		</li>
	{/each}
</ul>
