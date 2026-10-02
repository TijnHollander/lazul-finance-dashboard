<script lang="ts">
	import Icon from './Icon.svelte';
	let { onfiles, title, hint, accept = '.csv,.tab,.txt' }: { onfiles: (f: File[]) => void; title: string; hint: string; accept?: string } = $props();
	let over = $state(false);
	let input: HTMLInputElement;
</script>

<button
	type="button"
	class="flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-6 py-8 text-center transition-colors {over
		? 'border-purple-400/60 bg-purple-950/30'
		: 'border-white/15 bg-white/[0.02] hover:border-purple-500/40 hover:bg-purple-950/10'}"
	onclick={() => input.click()}
	ondragover={(e) => {
		e.preventDefault();
		over = true;
	}}
	ondragleave={() => (over = false)}
	ondrop={(e) => {
		e.preventDefault();
		over = false;
		const files = [...(e.dataTransfer?.files ?? [])];
		if (files.length) onfiles(files);
	}}
>
	<div class="grid size-10 place-items-center rounded-full border border-purple-500/30 bg-purple-950/40 text-purple-300"><Icon name="upload" /></div>
	<div class="text-sm font-medium text-white">{title}</div>
	<div class="max-w-lg text-xs text-white/45">{hint}</div>
	<input
		bind:this={input}
		type="file"
		{accept}
		multiple
		class="hidden"
		onchange={(e) => {
			const files = [...((e.target as HTMLInputElement).files ?? [])];
			if (files.length) onfiles(files);
			(e.target as HTMLInputElement).value = '';
		}}
	/>
</button>
