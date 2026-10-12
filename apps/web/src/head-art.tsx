import { lazy, Suspense, useEffect, useState } from "react";

// The mesh field, from the same package as the front page's ribbon, loaded after the page is on screen so the page
// never waits for it.
const Field = lazy(() =>
	import("@maschina/field").then((module) => ({ default: module.FogBackground })),
);

/** What every page head shares: held in place at the top, 50lvh tall, so a black sheet can roll over it. */
export const HEAD =
	"sticky top-0 flex h-[50lvh] min-h-[28rem] flex-col justify-center overflow-hidden px-(--gutter) pt-24 pb-12 sm:pb-16";

/** What every page body shares: a solid black sheet above the head, with the page margins. */
export const SHEET = "relative z-10 bg-black px-(--gutter)";

/**
 * The background of a page head: the moving mesh with a light dim over it so the words on top read. It fills its
 * parent, which must be `relative` or `sticky`, and it is decoration, so it is hidden from assistive technology.
 */
export function HeadArt() {
	const [ready, setReady] = useState(false);
	useEffect(() => setReady(true), []);
	return (
		<div data-art aria-hidden="true" className="pointer-events-none absolute inset-0">
			{ready ? (
				<Suspense fallback={null}>
					<div className="absolute inset-0 animate-fade-in motion-reduce:animate-none">
						<Field position="absolute" field="mesh" motion="full" mode="dark" />
					</div>
				</Suspense>
			) : null}
			{/* Frosted glass over the mesh: the blur takes the smudge out of its detail, and the light tint keeps the words clear. */}
			<div
				data-glass
				className="absolute inset-0 bg-[oklch(0_0_0/0.28)] backdrop-blur-[36px] backdrop-saturate-[0.85]"
			/>
		</div>
	);
}
