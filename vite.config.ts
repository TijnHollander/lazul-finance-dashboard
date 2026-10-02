import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, type Plugin } from 'vite';
import path from 'node:path';
import fs from 'node:fs';

/**
 * Laat de Vercel-functies uit /api ook draaien tijdens `npm run dev`,
 * zodat koersen en nieuws lokaal werken zonder Vercel CLI.
 */
function devApi(): Plugin {
	return {
		name: 'lazul-dev-api',
		configureServer(server) {
			server.middlewares.use(async (req, res, next) => {
				const m = req.url?.match(/^\/api\/([a-z]+)(\?|$)/);
				if (!m) return next();
				const file = path.resolve('api', `${m[1]}.js`);
				if (!fs.existsSync(file)) return next();
				try {
					const mod = await server.ssrLoadModule(file);
					await mod.default(req, res);
				} catch (e) {
					res.statusCode = 500;
					res.end(JSON.stringify({ error: String(e) }));
				}
			});
		}
	};
}

export default defineConfig({
	plugins: [devApi(), tailwindcss(), sveltekit()]
});
