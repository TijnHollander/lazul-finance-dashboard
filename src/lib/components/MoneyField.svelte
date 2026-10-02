<script lang="ts">
	let {
		label,
		value = $bindable(),
		hint = '',
		suffix = '€ / mnd',
		placeholder = '0'
	}: { label: string; value: number | null; hint?: string; suffix?: string; placeholder?: string } = $props();
	const id = 'f' + Math.random().toString(36).slice(2, 8);
</script>

<div class="grid gap-1.5">
	<label class="label" for={id}>{label}</label>
	<div class="relative">
		<input {id} class="input pr-20" type="number" inputmode="decimal" min="0" step="any" {placeholder} bind:value />
		<span class="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-white/35">{suffix}</span>
	</div>
	{#if hint}<span class="hint">{hint}</span>{/if}
</div>
