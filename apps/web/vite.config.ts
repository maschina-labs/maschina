import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { papers } from "./papers-plugin.ts";

export default defineConfig({
	envDir: "../..",
	plugins: [
		tanstackRouter({ target: "react", autoCodeSplitting: true }),
		react(),
		tailwindcss(),
		// The master papers live at the top of the repository, not inside the app.
		papers("../../papers"),
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
