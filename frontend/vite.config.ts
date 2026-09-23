import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

// En desarrollo, las llamadas a /api se redirigen a PocketBase (http://127.0.0.1:8090).
const POCKETBASE = process.env.PB_URL ?? 'http://127.0.0.1:8090';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	server: {
		port: 5173,
		proxy: {
			'/api': { target: POCKETBASE, changeOrigin: true },
			'/_': { target: POCKETBASE, changeOrigin: true }
		}
	},
	preview: {
		port: 4173,
		proxy: {
			'/api': { target: POCKETBASE, changeOrigin: true }
		}
	}
});
