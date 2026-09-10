import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "electron-vite";

const src = resolve(import.meta.dirname, "src");

export default defineConfig({
	main: {
		build: {
			outDir: "out/main",
			lib: { entry: resolve(src, "main/index.ts") },
			rollupOptions: {
				// node-pty is a native module: a pseudoterminal is a kernel feature,
				// so part of it is a compiled binary that cannot be bundled into
				// JavaScript. It is required at runtime from node_modules instead.
				external: ["node-pty"],
			},
		},
	},
	preload: {
		build: {
			outDir: "out/preload",
			lib: {
				entry: resolve(src, "preload/index.ts"),
				// CommonJS, deliberately. A preload running in a sandboxed renderer
				// cannot be an ES module. Electron loads it with `require`, and an
				// `import` statement fails with "Cannot use import statement outside a
				// module". Because package.json sets "type": "module", the extension
				// has to be .cjs for Node to treat the file as CommonJS.
				//
				// The alternative is `sandbox: false`, which trades a real security
				// boundary for a build convenience. Not worth it.
				formats: ["cjs"],
				fileName: () => "index.cjs",
			},
		},
	},
	renderer: {
		root: resolve(src, "renderer"),
		plugins: [react()],
		build: {
			outDir: resolve(import.meta.dirname, "out/renderer"),
			rollupOptions: { input: resolve(src, "renderer/index.html") },
		},
	},
});
