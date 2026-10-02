<script lang="ts">
	import { quotes, watchlist } from '$lib/stores';
	let { speed = 90 }: { speed?: number } = $props();

	const LABELS: Record<string, string> = { '^AEX': 'AEX', '^GSPC': 'S&P 500', '^IXIC': 'NASDAQ', 'EURUSD=X': 'EUR/USD', 'BTC-EUR': 'BTC' };
	const items = $derived(
		$watchlist.map((s) => {
			const q = $quotes[s];
			return { symbol: LABELS[s] ?? s.replace(/\.(AS|DE|PA|L|MI)$/, ''), change: q && !q.error && isFinite(q.changePct) ? q.changePct : null };
		})
	);
	const seq = $derived(Array.from({ length: Math.max(2, Math.ceil(24 / Math.max(1, items.length))) }, () => items).flat());
</script>

<div
	class="relative w-full overflow-hidden border-b border-white/5 bg-black/40 py-2 backdrop-blur-sm"
	style="mask-image: linear-gradient(to right, transparent, black 8%, black 92%, transparent); -webkit-mask-image: linear-gradient(to right, transparent, black 8%, black 92%, transparent);"
	aria-label="Koersen uit je volglijst"
>
	<div class="ticker-track flex w-max gap-10" style={`animation-duration: ${speed}s`}>
		{#each [0, 1] as copy (copy)}
			<div class="flex shrink-0 gap-10" aria-hidden={copy === 1}>
				{#each seq as t, i (copy + '-' + i)}
					<div class="flex items-center gap-2 text-xs font-medium whitespace-nowrap">
						<span class="text-white/70">{t.symbol}</span>
						{#if t.change == null}
							<span class="text-white/30">—</span>
						{:else}
							<span class={t.change >= 0 ? 'text-emerald-400/80' : 'text-red-400/80'}>{t.change >= 0 ? '+' : ''}{t.change.toFixed(2)}%</span>
						{/if}
					</div>
				{/each}
			</div>
		{/each}
	</div>
</div>

<style>
	.ticker-track {
		animation: ticker linear infinite;
		will-change: transform;
	}
	.ticker-track:hover {
		animation-play-state: paused;
	}
	@keyframes ticker {
		from { transform: translateX(0); }
		to { transform: translateX(-50%); }
	}
	@media (prefers-reduced-motion: reduce) {
		.ticker-track { animation: none; }
	}
</style>
