<script lang="ts">
	let { label, checked = $bindable(), hint = '' }: { label: string; checked: boolean; hint?: string } = $props();
</script>

<label class="flex cursor-pointer items-start gap-3 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2.5 text-sm hover:border-purple-500/30">
	<input type="checkbox" class="mt-0.5 size-4 shrink-0 accent-purple-400" bind:checked />
	<span><span class="text-white/85">{label}</span>{#if hint}<span class="block text-xs text-white/45">{hint}</span>{/if}</span>
</label>
