<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { CsvTable } from '$lib/parsers/csv';
	import Icon from './Icon.svelte';

	let {
		title,
		fileName,
		detected,
		confident,
		table,
		fields,
		cols = $bindable(),
		top,
		summary,
		onconfirm,
		oncancel
	}: {
		title: string;
		fileName: string;
		detected: string;
		confident: boolean;
		table: CsvTable;
		fields: { key: string; label: string }[];
		cols: Record<string, number | undefined>;
		top?: Snippet;
		summary?: Snippet;
		onconfirm: () => void;
		oncancel: () => void;
	} = $props();

	let showMapping = $state(false);
	$effect.pre(() => { if (!confident) showMapping = true; });
	const preview = $derived(table.rows.slice(0, 5));
</script>

<div class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm sm:items-center" role="dialog" aria-modal="true" aria-label={title}>
	<div class="glass my-8 w-full max-w-4xl p-6">
		<div class="mb-4 flex items-start justify-between gap-4">
			<div>
				<h2 class="text-lg font-semibold">{title}</h2>
				<p class="text-sm text-white/50">{fileName} · {table.rows.length} regels</p>
			</div>
			<button class="rounded-md p-1.5 text-white/50 hover:bg-white/5 hover:text-white" aria-label="Sluiten" onclick={oncancel}><Icon name="x" class="size-5" /></button>
		</div>

		<div class="mb-4 flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-sm {confident ? 'border-emerald-500/20 bg-emerald-950/20 text-emerald-200' : 'border-yellow-500/20 bg-yellow-950/20 text-yellow-100'}">
			<Icon name={confident ? 'check' : 'alert'} />
			{#if confident}Herkend als <b>{detected}</b>.{:else}Formaat niet zeker herkend (gok: <b>{detected}</b>). Controleer de kolommen hieronder.{/if}
			<button class="ml-auto text-xs underline underline-offset-2 opacity-80 hover:opacity-100" onclick={() => (showMapping = !showMapping)}>
				{showMapping ? 'Koppeling verbergen' : 'Kolommen aanpassen'}
			</button>
		</div>

		{#if top}{@render top()}{/if}

		{#if showMapping}
			<div class="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
				{#each fields as f (f.key)}
					<label class="grid gap-1">
						<span class="text-xs text-white/60">{f.label}</span>
						<select class="input h-9" bind:value={cols[f.key]}>
							<option value={-1}>— niet gebruiken —</option>
							{#each table.headers as h, i (i)}
								<option value={i}>{h}{table.rows[0]?.[i] ? ` · ${table.rows[0][i].slice(0, 18)}` : ''}</option>
							{/each}
						</select>
					</label>
				{/each}
			</div>
			<div class="mb-4 overflow-x-auto rounded-lg border border-white/10">
				<table class="table text-xs">
					<thead><tr>{#each table.headers as h, i (i)}<th class="whitespace-nowrap">{h}</th>{/each}</tr></thead>
					<tbody>
						{#each preview as r, ri (ri)}
							<tr>{#each r as c, ci (ci)}<td class="max-w-48 truncate whitespace-nowrap">{c}</td>{/each}</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}

		{#if summary}{@render summary()}{/if}

		<div class="mt-6 flex justify-end gap-2">
			<button class="btn btn-ghost" onclick={oncancel}>Annuleren</button>
			<button class="btn btn-primary" onclick={onconfirm}><Icon name="check" /> Importeren</button>
		</div>
	</div>
</div>
