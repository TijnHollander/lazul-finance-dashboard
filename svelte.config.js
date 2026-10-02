import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

// BASE_PATH wordt door de GitHub Pages workflow gezet (bijv. "/lazul-finance").
// Op Vercel of lokaal blijft hij leeg.
const base = process.env.BASE_PATH ?? '';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	compilerOptions: {
		runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true)
	},
	kit: {
		adapter: adapter({ pages: 'build', assets: 'build', fallback: '404.html', strict: true }),
		paths: { base, relative: false }
	}
};

export default config;
