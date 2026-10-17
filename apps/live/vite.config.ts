import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
	envDir: "../..",
	plugins: [
		react(),
		tailwindcss(),
		// Made-up trades for looking at the page, while developing only: the dev server loads them
		// before the app, and a build never sees them (src/dev/sample.ts).
		{
			name: "maschina-sample-record",
			apply: "serve" as const,
			transformIndexHtml: () => [
				{
					tag: "script",
					attrs: { type: "module", src: "/src/dev/sample-boot.ts" },
					injectTo: "head" as const,
				},
			],
		},
	],
	build: {
		sourcemap: true,
		target: "es2024",
	},
	server: {
		port: 3004,
		strictPort: true,
	},
});
