import { lazy, Suspense, useEffect, useState } from "react";

// The ribbon is WebGL and pulls in three.js, which is heavy: it loads after the page is on screen, so the
// page never waits for it.
const Ribbon = lazy(() =>
	import("@maschina/field").then((module) => ({ default: module.FogBackground })),
);

/**
 * The first screen: the silver and pearl ribbon and nothing else, for now. The words, the buttons and the
 * floating pieces were tried and taken out (the last version with them is in the history); they come back
 * one at a time. The layers are decoration, so they are hidden from assistive technology.
 */
export function Hero() {
	const [ready, setReady] = useState(false);

	useEffect(() => setReady(true), []);

	return (
		<section aria-label="Maschina" className="relative min-h-dvh overflow-hidden">
			<div aria-hidden="true" className="pointer-events-none absolute inset-0">
				{ready ? (
					<Suspense fallback={null}>
						<Ribbon position="absolute" field="ribbon" motion="calm" mode="dark" />
					</Suspense>
				) : null}
				{/* Dimmed so what goes on top of it reads, and melting into the page at the bottom. */}
				<div data-dim className="absolute inset-0 bg-[oklch(0_0_0/0.5)]" />
				<div
					data-melt
					className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-b from-transparent to-black"
				/>
			</div>
		</section>
	);
}
