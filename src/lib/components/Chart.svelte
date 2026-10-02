<script lang="ts">
	import { onMount } from 'svelte';
	import Chart from 'chart.js/auto';
	import type { ChartConfiguration } from 'chart.js';
	import { INK } from '$lib/palette';

	let { config, height = 260, class: cls = "" }: { config: ChartConfiguration<any, any, any>; height?: number; class?: string } = $props();

	let canvas: HTMLCanvasElement;
	let chart: Chart | null = null;

	Chart.defaults.color = INK.secondary;
	Chart.defaults.font.family = "'Geist Variable', system-ui, sans-serif";
	Chart.defaults.font.size = 11;
	Chart.defaults.borderColor = INK.grid;
	Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(10,6,16,0.95)';
	Chart.defaults.plugins.tooltip.borderColor = 'rgba(168,85,247,0.35)';
	Chart.defaults.plugins.tooltip.borderWidth = 1;
	Chart.defaults.plugins.tooltip.padding = 10;
	Chart.defaults.plugins.tooltip.titleColor = INK.primary;
	Chart.defaults.plugins.tooltip.bodyColor = INK.primary;
	Chart.defaults.plugins.tooltip.boxPadding = 4;
	Chart.defaults.plugins.legend.labels.usePointStyle = true;
	Chart.defaults.plugins.legend.labels.boxWidth = 8;

	onMount(() => {
		chart = new Chart(canvas, $state.snapshot(config) as ChartConfiguration);
		return () => chart?.destroy();
	});

	$effect(() => {
		const c = $state.snapshot(config) as ChartConfiguration;
		if (!chart) return;
		chart.data = c.data;
		if (c.options) chart.options = c.options;
		chart.update('none');
	});
</script>

<div class="relative w-full min-w-0 {cls}" style="height:{height}px">
	<canvas bind:this={canvas}></canvas>
</div>
