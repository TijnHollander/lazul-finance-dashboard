<script lang="ts">
	import { onMount } from 'svelte';
	import { lastQuoteRefresh, refreshIntervalSec } from '$lib/live';
	let { label = '' }: { label?: string } = $props();
	let now = $state(Date.now());
	onMount(() => {
		const t = setInterval(() => (now = Date.now()), 5000);
		return () => clearInterval(t);
	});
	const ago = $derived($lastQuoteRefresh ? Math.max(0, Math.round((now - $lastQuoteRefresh) / 1000)) : null);
	const text = $derived(label || (ago == null ? `live · elke ${$refreshIntervalSec} s` : `live · ${ago < 10 ? 'zojuist' : `${ago} s geleden`}`));
</script>

<span class="inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-950/25 px-3 py-1 text-xs text-emerald-200" title="Wordt automatisch ververst zolang dit tabblad open staat">
	<span class="relative flex size-2"><span class="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60"></span><span class="relative inline-flex size-2 rounded-full bg-emerald-400"></span></span>
	{text}
</span>
