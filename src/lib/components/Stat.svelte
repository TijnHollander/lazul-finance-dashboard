<script lang="ts">
	import type { Snippet } from 'svelte';
	let { label, value, sub = '', tone = 'neutral', children }: { label: string; value: string; sub?: string; tone?: 'neutral' | 'pos' | 'neg' | 'brand'; children?: Snippet } = $props();
</script>

<div class="card flex flex-col gap-1">
	<span class="card-title">{label}</span>
	<span class="num text-2xl font-semibold tracking-tight {tone === 'pos' ? 'text-emerald-400' : tone === 'neg' ? 'text-red-400' : tone === 'brand' ? 'text-purple-300' : 'text-white'}">{value}</span>
	{#if sub}<span class="text-xs text-white/45">{sub}</span>{/if}
	{#if children}{@render children()}{/if}
</div>
