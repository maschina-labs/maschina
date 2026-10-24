import mdx from "@mdx-js/rollup";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
	envDir: "../..",
	plugins: [mdx(), react(), tailwindcss()],
	build: {
		sourcemap: true,
		target: "es2024",
	},
	server: {
		port: 3000,
		strictPort: true,
		proxy: {
			"/v1/public/record": { target: "https://api.maschina.dev", changeOrigin: true },
			"/__public-record": {
				target: "https://api.maschina.dev",
				changeOrigin: true,
				rewrite: () => "/v1/public/record",
			},
		},
	},
});
