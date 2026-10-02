<script lang="ts">
	let { values = [], width = 90, height = 28 }: { values?: number[]; width?: number; height?: number } = $props();
	const path = $derived.by(() => {
		const v = values.filter((x) => x != null && isFinite(x));
		if (v.length < 2) return '';
		const min = Math.min(...v), max = Math.max(...v);
		const span = max - min || 1;
		return v.map((x, i) => `${i ? 'L' : 'M'}${((i / (v.length - 1)) * width).toFixed(1)},${(height - 2 - ((x - min) / span) * (height - 4)).toFixed(1)}`).join(' ');
	});
	const up = $derived(values.length > 1 && values[values.length - 1] >= values[0]);
</script>

{#if path}
	<svg {width} {height} viewBox="0 0 {width} {height}" class="overflow-visible" aria-hidden="true">
		<path d={path} fill="none" stroke={up ? '#34d399' : '#f87171'} stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" />
	</svg>
{/if}
