import { useEffect, useRef } from "react";

/** A latitude or longitude as a navigator writes it: three decimals and a compass letter. */
export function coordinate(value: number, axis: "lat" | "lng"): string {
	const letter = axis === "lat" ? (value >= 0 ? "N" : "S") : value >= 0 ? "E" : "W";
	return `${Math.abs(value).toFixed(3)}°${letter}`;
}

/**
 * The point the globe faces, easing toward wherever it turns so the numbers track rather than jump.
 * Written straight to the element each frame, so sixty updates a second never re-render React.
 */
export function Coordinates({ target }: { target: { lat: number; lng: number } }) {
	const aim = useRef(target);
	const shown = useRef({ ...target });
	const line = useRef<HTMLSpanElement>(null);
	aim.current = target;
	useEffect(() => {
		let frame = 0;
		const tick = () => {
			shown.current.lat += (aim.current.lat - shown.current.lat) * 0.1;
			shown.current.lng += (aim.current.lng - shown.current.lng) * 0.1;
			if (line.current) {
				line.current.textContent = `${coordinate(shown.current.lat, "lat")} / ${coordinate(shown.current.lng, "lng")}`;
			}
			frame = requestAnimationFrame(tick);
		};
		frame = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(frame);
	}, []);
	return (
		<span ref={line} className="text-[10.5px] text-neutral-500 tabular-nums tracking-[0.14em]">
			{coordinate(target.lat, "lat")} / {coordinate(target.lng, "lng")}
		</span>
	);
}
