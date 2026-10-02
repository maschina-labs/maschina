import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Plugin } from "vite";
import { type PaperListing, pagesIn, paperFrom } from "./src/lib/papers.ts";

/**
 * Serves the master papers from the repository's papers folder, at /papers/<slug>.pdf, and tells the app
 * which papers there are through "virtual:papers". The folder is the only copy: nothing is duplicated
 * into the app, and a paper dropped into the folder appears in its place on the next build, or at once
 * while developing.
 */

const ID = "virtual:papers";
const RESOLVED = `\0${ID}`;

export function papers(folder: string): Plugin {
	const dir = resolve(folder);
	const read = (): PaperListing[] =>
		readdirSync(dir)
			.map(paperFrom)
			.filter((paper) => paper !== undefined)
			.map((paper) => ({ ...paper, pages: pagesIn(readFileSync(resolve(dir, paper.file))) }))
			.sort((a, b) => a.number - b.number);

	return {
		name: "maschina-papers",
		resolveId: (id) => (id === ID ? RESOLVED : undefined),
		load: (id) => (id === RESOLVED ? `export default ${JSON.stringify(read())};` : undefined),
		configureServer(server) {
			server.watcher.add(dir);
			const refresh = (file: string) => {
				if (!file.startsWith(dir)) return;
				const module = server.moduleGraph.getModuleById(RESOLVED);
				if (module) server.reloadModule(module);
			};
			server.watcher.on("add", refresh);
			server.watcher.on("unlink", refresh);
			server.watcher.on("change", refresh);
			server.middlewares.use((request, response, next) => {
				const slug = /^\/papers\/([a-z0-9-]+)\.pdf$/.exec(request.url ?? "")?.[1];
				const paper = slug ? read().find((each) => each.slug === slug) : undefined;
				if (!paper) return next();
				response.setHeader("content-type", "application/pdf");
				response.end(readFileSync(resolve(dir, paper.file)));
			});
		},
		generateBundle() {
			for (const paper of read()) {
				this.emitFile({
					type: "asset",
					fileName: `papers/${paper.slug}.pdf`,
					source: readFileSync(resolve(dir, paper.file)),
				});
			}
		},
	};
}
