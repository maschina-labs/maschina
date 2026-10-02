import { geoGraticule10, geoOrthographic, geoPath } from "d3-geo";
import { useEffect, useMemo, useRef, useState } from "react";
import { feature } from "topojson-client";
import worldUrl from "world-atlas/countries-110m.json?url";

/**
 * A wireframe Earth: country outlines, a dashed graticule and the rim of the sphere, see-through so the
 * far side shows faintly behind the near one, turning slowly. Drawn as plain SVG lines with d3-geo, so it is monochrome and sharp at any size.
 * The outlines are Natural Earth at 1:110m (world-atlas), fetched once rather than bundled.
 */

const SIZE = 600;
/** Degrees a second. Slow enough to read as the planet turning, not as a spinner. */
const TURN = 4;

type Countries = GeoJSON.FeatureCollection;

async function loadCountries(): Promise<Countries> {
	// Typed through topojson-client's own signature, rather than a types package it only depends on.
	type World = Parameters<typeof feature>[0] & {
		objects: { countries: Parameters<typeof feature>[1] };
	};
	const topology = (await (await fetch(worldUrl)).json()) as World;
	return feature(topology, topology.objects.countries) as unknown as Countries;
}

export function Globe({
	tilt = -18,
	onView,
}: {
	tilt?: number;
	/** Told the point on Earth at the centre of the globe, whenever it turns. */
	onView?: (centre: { lat: number; lng: number }) => void;
}) {
	const [countries, setCountries] = useState<Countries>();
	const [view, setView] = useState<[number, number]>([0, tilt]);
	/** Where a drag started, and what the view was then. Empty when nobody is holding the globe. */
	const drag = useRef<{ x: number; y: number; from: [number, number] } | undefined>(undefined);
	const svg = useRef<SVGSVGElement>(null);

	useEffect(() => {
		let live = true;
		void loadCountries().then((loaded) => live && setCountries(loaded));
		return () => {
			live = false;
		};
	}, []);

	useEffect(() => {
		// Reduced motion keeps the globe still, though it can still be turned by hand.
		if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
		const element = svg.current;
		if (!element) return;
		let frame = 0;
		let last = performance.now();
		const tick = (now: number) => {
			// Thirty times a second is plenty for a slow turn, and half the redrawing of every frame.
			if (now - last >= 1000 / 30) {
				const seconds = Math.min((now - last) / 1000, 0.1);
				last = now;
				// It stops while held, and carries on from wherever it was let go.
				if (!drag.current) setView(([lon, lat]) => [lon + seconds * TURN, lat]);
			}
			frame = requestAnimationFrame(tick);
		};
		// Turning only while it can be seen: the page beside the one on screen is drawn too, so the next
		// slide is ready, and a globe turning off screen would redraw a map nobody is looking at.
		const watch = new IntersectionObserver(([entry]) => {
			cancelAnimationFrame(frame);
			if (entry?.isIntersecting) {
				last = performance.now();
				frame = requestAnimationFrame(tick);
			}
		});
		watch.observe(element);
		return () => {
			watch.disconnect();
			cancelAnimationFrame(frame);
		};
	}, []);

	const grab = (event: React.PointerEvent<SVGSVGElement>) => {
		event.currentTarget.setPointerCapture(event.pointerId);
		drag.current = { x: event.clientX, y: event.clientY, from: view };
	};
	const move = (event: React.PointerEvent<SVGSVGElement>) => {
		const held = drag.current;
		if (!held) return;
		// A quarter of a degree per pixel, and never tipped past 70 degrees so it cannot turn upside down.
		const lon = held.from[0] + (event.clientX - held.x) * 0.25;
		const lat = Math.max(-70, Math.min(70, held.from[1] - (event.clientY - held.y) * 0.25));
		setView([lon, lat]);
	};
	const release = () => {
		drag.current = undefined;
	};

	// The point facing the viewer is the opposite of the rotation.
	useEffect(() => {
		const wrapped = ((((-view[0] + 180) % 360) + 360) % 360) - 180;
		onView?.({ lat: -view[1], lng: wrapped });
	}, [view, onView]);

	// Two views of the same turning planet. The near side is clipped at the horizon and drawn bright; the
	// whole planet unclipped is drawn faint underneath, so the far side shows through like a wireframe.
	const near = useMemo(
		() =>
			geoOrthographic()
				.scale(SIZE * 0.4)
				.translate([SIZE / 2, SIZE / 2])
				.clipAngle(90)
				.rotate(view),
		[view],
	);
	const whole = useMemo(
		() =>
			geoOrthographic()
				.scale(SIZE * 0.4)
				.translate([SIZE / 2, SIZE / 2])
				.clipAngle(180)
				.rotate(view),
		[view],
	);
	const front = geoPath(near);
	const through = geoPath(whole);
	const grid = geoGraticule10();

	return (
		<svg
			ref={svg}
			viewBox={`0 0 ${SIZE} ${SIZE}`}
			role="img"
			aria-label="The network, on a turning globe"
			className="h-full w-full cursor-grab touch-none select-none active:cursor-grabbing"
			onPointerDown={grab}
			onPointerMove={move}
			onPointerUp={release}
			onPointerCancel={release}
		>
			<path
				d={through(grid) ?? ""}
				fill="none"
				stroke="rgba(255,255,255,0.035)"
				strokeWidth={0.5}
				strokeDasharray="2 4"
			/>
			{countries ? (
				<path
					d={through(countries) ?? ""}
					fill="none"
					stroke="rgba(255,255,255,0.06)"
					strokeWidth={0.5}
				/>
			) : null}
			<path
				d={front(grid) ?? ""}
				fill="none"
				stroke="rgba(255,255,255,0.11)"
				strokeWidth={0.6}
				strokeDasharray="2 4"
			/>
			<path
				d={front({ type: "Sphere" }) ?? ""}
				fill="none"
				stroke="rgba(255,255,255,0.22)"
				strokeWidth={0.8}
			/>
			{countries ? (
				<path
					d={front(countries) ?? ""}
					fill="none"
					stroke="rgba(255,255,255,0.34)"
					strokeWidth={0.6}
				/>
			) : null}
		</svg>
	);
}
