import { lazy, Suspense, useEffect, useRef, useState } from "react";

/**
 * The backgrounds behind the feature sections, three kinds so no two neighbors look alike. They are all quiet
 * and all cheap: the mesh is plain CSS and costs nothing, the particles are a few dozen dots on one small
 * canvas that only draws while it is on screen, and the ribbon is the hero's WebGL ribbon, started only when its
 * section is near the screen and stopped again when it leaves, so there is never more than one running beside
 * the hero's. Anyone who asked for less motion gets a still picture of each. They are all decoration.
 */

// The ribbon is WebGL and pulls in three.js: it loads only when it is first needed.
const Ribbon = lazy(() =>
	import("@maschina/field").then((module) => ({ default: module.FogBackground })),
);

const MESH = {
	pearl:
		"bg-[radial-gradient(55%_45%_at_18%_22%,oklch(0.74_0.05_300/0.75),transparent_70%),radial-gradient(50%_45%_at_86%_30%,oklch(0.66_0.045_250/0.65),transparent_70%),radial-gradient(70%_55%_at_50%_100%,oklch(0.62_0.05_320/0.6),transparent_70%)]",
	silver:
		"bg-[radial-gradient(55%_45%_at_82%_20%,oklch(0.72_0.04_235/0.75),transparent_70%),radial-gradient(50%_50%_at_14%_70%,oklch(0.64_0.035_260/0.65),transparent_70%),radial-gradient(70%_55%_at_55%_0%,oklch(0.8_0.025_280/0.5),transparent_70%)]",
} as const;

/** A mesh of soft pearl or silver light, in plain CSS. */
export function Mesh({ tone }: { tone: keyof typeof MESH }) {
	return <div className={`absolute inset-0 ${MESH[tone]}`} />;
}

/** True while the element is within a screen's height of the viewport. Where the browser cannot say, false. */
function useNear(ref: React.RefObject<Element | null>, margin = "100%") {
	const [near, setNear] = useState(false);
	useEffect(() => {
		const node = ref.current;
		if (!node || typeof IntersectionObserver === "undefined") return;
		const watcher = new IntersectionObserver(([entry]) => setNear(Boolean(entry?.isIntersecting)), {
			rootMargin: `${margin} 0px`,
		});
		watcher.observe(node);
		return () => watcher.disconnect();
	}, [ref, margin]);
	return near;
}

const COUNT = 70;

/** Sparse, slow dots drifting up on one small canvas. It draws only while on screen. */
export function Particles() {
	const canvas = useRef<HTMLCanvasElement>(null);
	const near = useNear(canvas, "0%");

	useEffect(() => {
		const node = canvas.current;
		const context = node?.getContext?.("2d");
		if (!node || !context) return;
		const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
		// The same dots every time: a little deterministic scatter, so the picture does not change on a revisit.
		let seed = 7;
		const random = () => {
			seed = (seed * 1664525 + 1013904223) % 4294967296;
			return seed / 4294967296;
		};
		const dots = Array.from({ length: COUNT }, () => ({
			x: random(),
			y: random(),
			size: 0.6 + random() * 1.3,
			speed: 0.00004 + random() * 0.00008,
			alpha: 0.15 + random() * 0.4,
		}));
		const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
		const fit = () => {
			node.width = Math.max(1, Math.round(node.clientWidth * ratio));
			node.height = Math.max(1, Math.round(node.clientHeight * ratio));
		};
		const draw = () => {
			context.clearRect(0, 0, node.width, node.height);
			for (const dot of dots) {
				context.globalAlpha = dot.alpha;
				context.fillStyle = "oklch(0.96 0.01 280)";
				context.beginPath();
				context.arc(dot.x * node.width, dot.y * node.height, dot.size * ratio, 0, Math.PI * 2);
				context.fill();
			}
		};
		fit();
		draw();
		if (still || !near) return;
		let frame = 0;
		let last = performance.now();
		const tick = (time: number) => {
			const elapsed = Math.min(time - last, 64);
			last = time;
			for (const dot of dots) {
				dot.y -= dot.speed * elapsed;
				if (dot.y < -0.02) dot.y = 1.02;
			}
			draw();
			frame = requestAnimationFrame(tick);
		};
		frame = requestAnimationFrame(tick);
		window.addEventListener("resize", fit);
		return () => {
			cancelAnimationFrame(frame);
			window.removeEventListener("resize", fit);
		};
	}, [near]);

	return <canvas ref={canvas} className="absolute inset-0 size-full" />;
}

/** The ribbon, mounted only while its section is near the screen, over a dim layer so what is on top reads. */
export function RibbonWhenNear() {
	const holder = useRef<HTMLDivElement>(null);
	const near = useNear(holder);
	return (
		<div ref={holder} className="absolute inset-0">
			{near ? (
				<Suspense fallback={null}>
					<div className="absolute inset-0 animate-fade-in motion-reduce:animate-none">
						<Ribbon position="absolute" field="ribbon" motion="calm" mode="dark" />
					</div>
					<div className="absolute inset-0 bg-[oklch(0_0_0/0.45)]" />
				</Suspense>
			) : null}
		</div>
	);
}
