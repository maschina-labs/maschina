import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
	envDir: "../..",
	plugins: [
		tanstackRouter({ target: "react", autoCodeSplitting: true }),
		react(),
		tailwindcss(),
		// Made-up data for looking at the app, while developing only: the dev server's page loads it before
		// the app, and a build never sees it (src/dev/seed.ts).
		{
			name: "maschina-seed",
			apply: "serve",
			transformIndexHtml: () => [
				{
					tag: "script",
					attrs: { type: "module", src: "/src/dev/seed-boot.ts" },
					injectTo: "head",
				},
			],
		},
	],
	build: {
		sourcemap: true,
		target: "es2024",
	},
	server: {
		port: 3000,
		strictPort: true,
	},
});
