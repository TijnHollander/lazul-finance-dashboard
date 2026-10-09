<script lang="ts" generics="T extends string | number | boolean | null">
	let { options, value = $bindable(), size = 'md' }: { options: [T, string][]; value: T; size?: 'sm' | 'md' } = $props();
</script>

<div class="flex flex-wrap gap-2" role="radiogroup">
	{#each options as [v, l] (String(v))}
		<button
			type="button"
			role="radio"
			aria-checked={value === v}
			class="btn {value === v ? 'btn-primary' : 'btn-ghost'} {size === 'sm' ? 'px-3 py-1 text-xs' : 'py-1.5'}"
			onclick={() => (value = v)}>{l}</button
		>
	{/each}
</div>
