import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import type { ShaderMaterial } from "three";
import { Vector2, Vector3 } from "three";
import { CLEAR, type Weather } from "../lib/weather.ts";

/**
 * The field behind the terminal: city light through a fogged window, far out of focus. Dark olive at
 * the top, a slate blue haze across the upper middle, warm gray fog through the center, amber glowing
 * on the right, near black at the bottom. Each patch is shaped by slow rolling noise, so it breathes.
 *
 * Colors are chosen in OKLCH and mixed in OKLab, where equal steps look equal, so the glows fade into
 * the dark without the muddy rings plain RGB leaves around a soft light.
 */

type Oklch = { l: number; c: number; h: number };

/** The fog's five colors: the dark, the top, the upper haze, the middle fog, and the one glow. */
export type Palette = { night: Oklch; top: Oklch; upper: Oklch; middle: Oklch; glow: Oklch };

/**
 * City, measured from Ash's Obsidian reference (2026-09-28), region by region. The only palette for now;
 * themes come back with a theme switcher (the Gen X Soft Club hues among them).
 */
export type Mode = "dark" | "light";

const CITY_DARK: Palette = {
	night: { l: 0.16, c: 0.002, h: 286 },
	top: { l: 0.246, c: 0.021, h: 136 },
	upper: { l: 0.367, c: 0.021, h: 232 },
	middle: { l: 0.405, c: 0.012, h: 72 },
	glow: { l: 0.471, c: 0.047, h: 77 },
};

/**
 * The same city in daylight: every region keeps its hue and its place, and the light is turned up, so
 * the field reads as morning haze rather than night. Each theme has both.
 */
const CITY_LIGHT: Palette = {
	night: { l: 0.93, c: 0.004, h: 286 },
	top: { l: 0.87, c: 0.022, h: 136 },
	upper: { l: 0.82, c: 0.022, h: 232 },
	middle: { l: 0.89, c: 0.012, h: 72 },
	glow: { l: 0.92, c: 0.05, h: 77 },
};

const CITY: Record<Mode, Palette> = { dark: CITY_DARK, light: CITY_LIGHT };

/** OKLCH to OKLab, the form the shader mixes in. */
const lab = ({ l, c, h }: Oklch) => {
	const radians = (h * Math.PI) / 180;
	return [l, c * Math.cos(radians), c * Math.sin(radians)] as const;
};
const vector = (color: Oklch) => new Vector3(...lab(color));
const css = ({ l, c, h }: Oklch) => `oklch(${l} ${c} ${h})`;

const VERTEX = /* glsl */ `
	varying vec2 vUv;
	void main() {
		vUv = uv;
		// A 2x2 plane is already clip space, so this is a fullscreen quad no camera can move.
		gl_Position = vec4(position.xy, 0.0, 1.0);
	}
`;

const FRAGMENT = /* glsl */ `
	precision highp float;

	uniform float uTime;
	uniform vec2 uResolution;
	varying vec2 vUv;

	// The palette arrives as inputs, in OKLab, so it can change without rebuilding the shader.
	uniform vec3 NIGHT;
	uniform vec3 OLIVE;
	uniform vec3 SLATE;
	uniform vec3 FOG;
	uniform vec3 AMBER;

	// The weather, each eased toward the forecast on the CPU so a change rolls in rather than cuts.
	uniform float uSnow;
	uniform float uCloud;
	uniform float uFog;
	uniform float uFlash;

	// White noise from fract alone. The usual fract(sin(...)) hash breaks down on GPUs as its input grows,
	// and time grows forever.
	float hash(vec3 p3) {
		p3 = fract(p3 * 0.1031);
		p3 += dot(p3, p3.zyx + 31.32);
		return fract((p3.x + p3.y) * p3.z);
	}

	float noise(vec2 p) {
		vec2 i = floor(p);
		vec2 f = fract(p);
		f = f * f * (3.0 - 2.0 * f);
		float a = hash(vec3(i, 7.0));
		float b = hash(vec3(i + vec2(1.0, 0.0), 7.0));
		float c = hash(vec3(i + vec2(0.0, 1.0), 7.0));
		float d = hash(vec3(i + vec2(1.0, 1.0), 7.0));
		return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
	}

	// Three broad octaves, turned between octaves so no grid shows. Coarse on purpose: this is meant to
	// look out of focus, and fine detail is exactly what a blur removes.
	float smoke(vec2 p) {
		float v = 0.0;
		float amp = 0.55;
		float total = 0.0;
		mat2 turn = mat2(0.8, -0.6, 0.6, 0.8);
		for (int i = 0; i < 3; i++) {
			v += amp * noise(p);
			total += amp;
			p = turn * p * 1.9 + vec2(1.7, 9.2);
			amp *= 0.4;
		}
		return v / total;
	}

	// OKLab to sRGB (Ottosson's matrices, then the sRGB curve), because the canvas writes straight out.
	vec3 toScreen(vec3 c) {
		float l_ = c.x + 0.3963377774 * c.y + 0.2158037573 * c.z;
		float m_ = c.x - 0.1055613458 * c.y - 0.0638541728 * c.z;
		float s_ = c.x - 0.0894841775 * c.y - 1.2914855480 * c.z;
		vec3 lms = vec3(l_ * l_ * l_, m_ * m_ * m_, s_ * s_ * s_);
		vec3 linear = clamp(vec3(
			4.0767416621 * lms.x - 3.3077115913 * lms.y + 0.2309699292 * lms.z,
			-1.2684380046 * lms.x + 2.6097574011 * lms.y - 0.3413193965 * lms.z,
			-0.0041960863 * lms.x - 0.7034186147 * lms.y + 1.7076147010 * lms.z
		), 0.0, 1.0);
		vec3 low = linear * 12.92;
		vec3 high = 1.055 * pow(linear, vec3(1.0 / 2.4)) - 0.055;
		return mix(low, high, step(vec3(0.0031308), linear));
	}

	void main() {
		// 0 at the top, so "upper" and "lower" below read the way they are written.
		float y = 1.0 - vUv.y;
		float aspect = uResolution.x / max(uResolution.y, 1.0);
		vec2 p = vec2(vUv.x * aspect, y);

		// Each glow is its own slow smoke, rolled by a second slower layer so it billows, not slides.
		vec2 drift = vec2(p.x * 0.8 + uTime * 0.035, p.y * 1.2 + uTime * 0.018);
		vec2 roll = vec2(smoke(drift * 0.5 + uTime * 0.014), smoke(drift * 0.5 - uTime * 0.011 + 4.1));
		float cold = smoke(drift + roll * 1.4);
		float warm = smoke(drift * 1.1 + vec2(5.2, 1.3) - roll * 1.2);

		// Where each light lives, laid out as in the reference. Bands overlap widely so nothing has an edge.
		float atTop = smoothstep(0.3, 0.0, y);
		float atSlate = smoothstep(0.1, 0.33, y) * smoothstep(0.55, 0.33, y);
		float atFog = smoothstep(0.3, 0.48, y) * smoothstep(0.75, 0.5, y);
		float atAmber = smoothstep(0.35, 0.58, y) * smoothstep(0.95, 0.65, y) * smoothstep(aspect * 0.45, aspect, p.x);

		vec3 color = mix(NIGHT, OLIVE, atTop * (0.6 + 0.4 * cold));
		color = mix(color, SLATE, atSlate * smoothstep(0.25, 0.7, cold));
		color = mix(color, FOG, atFog * smoothstep(0.3, 0.75, warm) * 0.9);
		color = mix(color, AMBER, atAmber * smoothstep(0.3, 0.75, warm));

		// Overcast: the glow dims and the color drains, as a city does under low cloud.
		color = mix(color, NIGHT, atAmber * smoothstep(0.3, 0.75, warm) * uCloud * 0.6);
		color.yz *= 1.0 - 0.45 * uCloud;
		color.x *= 1.0 - 0.12 * uCloud;

		// Fog: everything goes further away, into one soft gray that still rolls.
		float haze = 0.26 + 0.1 * cold + 0.5 * (NIGHT.x - 0.16);
		color = mix(color, vec3(haze, 0.0, 0.0), uFog * 0.65 * (0.75 + 0.25 * warm));

		// Lightning: the whole sky lit from up and to one side for a moment, cold and white, through the fog.
		float strike = smoothstep(1.3, 0.0, length(vec2(p.x - aspect * 0.25, y))) * (0.6 + 0.4 * cold);
		color.x += uFlash * 0.4 * strike;
		color.z -= uFlash * 0.02 * strike;

		// Snow, falling in the city beyond the glass: three depths, the near ones large and far out of
		// focus, the far ones small and sharper, all drifting on a slow wind.
		float flakes = 0.0;
		for (int i = 0; i < 3; i++) {
			float depth = float(i);
			float scale = 6.0 + depth * 7.0;
			float speed = 0.09 - depth * 0.022;
			vec2 q = p * scale;
			q.y -= uTime * speed * scale;
			q.x += uTime * 0.02 * scale + sin(q.y * 0.35 + depth * 2.1 + uTime * 0.3) * 0.35;
			vec2 cell = floor(q);
			vec2 inCell = fract(q) - 0.5;
			float seed = hash(vec3(cell, depth + 3.0));
			vec2 offset = vec2(hash(vec3(cell, depth + 11.0)), hash(vec3(cell, depth + 19.0))) - 0.5;
			float size = 0.16 - depth * 0.04;
			float soft = 0.16 - depth * 0.05;
			float flake = smoothstep(size, size - soft, length(inCell - offset * 0.6));
			// How many cells hold a flake is how hard it is snowing.
			flakes += flake * step(1.0 - uSnow * (0.55 - depth * 0.1), seed) * (0.55 - depth * 0.12);
		}
		color.x += flakes * 0.5;
		color.yz *= 1.0 - min(flakes, 1.0) * 0.6;

		// Dark at the edges, as an out of focus lens is.
		vec2 centered = vUv - 0.5;
		color.x *= mix(1.0, 0.72, smoothstep(0.25, 0.75, length(centered * vec2(1.1, 1.0))));

		// A whisper of dither, so the long dark fades never band on an 8-bit screen.
		color.x += (hash(vec3(floor(gl_FragCoord.xy), mod(floor(uTime * 12.0), 16.0))) - 0.5) * 0.004;

		gl_FragColor = vec4(toScreen(color), 1.0);
	}
`;

function Fog({ still, palette, weather }: { still: boolean; palette: Palette; weather: Weather }) {
	const material = useRef<ShaderMaterial>(null);
	const size = useThree((state) => state.size);
	// Made once: rebuilding uniforms would send the clock back to zero and make the field jump.
	const uniforms = useMemo(
		() => ({
			uTime: { value: 0 },
			uResolution: { value: new Vector2(1, 1) },
			NIGHT: { value: new Vector3() },
			OLIVE: { value: new Vector3() },
			SLATE: { value: new Vector3() },
			FOG: { value: new Vector3() },
			AMBER: { value: new Vector3() },
			uSnow: { value: 0 },
			uCloud: { value: 0 },
			uFog: { value: 0 },
			uFlash: { value: 0 },
		}),
		[],
	);

	// Drawn thirty times a second, not sixty: the drift is far too slow for the difference to show, and it
	// halves the work. The canvas only draws when asked (frameloop "demand"), so this is what asks.
	const invalidate = useThree((state) => state.invalidate);
	useEffect(() => {
		if (still) {
			invalidate();
			return;
		}
		const timer = setInterval(() => invalidate(), 1000 / 30);
		return () => clearInterval(timer);
	}, [invalidate, still]);

	// Lightning, in a storm: every twenty to sixty seconds, a strike and its echo. Never faster than
	// three flashes a second, and never with reduced motion asked for.
	const flash = useRef(0);
	useEffect(() => {
		if (!weather.lightning || still) return;
		let timer: ReturnType<typeof setTimeout>;
		const strike = () => {
			const started = performance.now();
			const pulse = (at: number, peak: number, fall: number) => {
				const t = at < 0 ? 0 : at < 40 ? at / 40 : Math.exp(-(at - 40) / fall);
				return peak * t;
			};
			const tick = () => {
				const at = performance.now() - started;
				flash.current = Math.max(pulse(at, 1, 120), pulse(at - 380, 0.7, 450));
				if (at < 2500) requestAnimationFrame(tick);
				else flash.current = 0;
			};
			tick();
			timer = setTimeout(strike, 20_000 + Math.random() * 40_000);
		};
		timer = setTimeout(strike, 4_000 + Math.random() * 6_000);
		return () => clearTimeout(timer);
	}, [weather.lightning, still]);

	// The time between frames, kept here: drawn on demand, the canvas's own frame time is always zero.
	const lastFrame = useRef<number | undefined>(undefined);
	// When the field started, for its clock. Kept here: drawn on demand, the canvas's own clock stands still.
	const started = useRef(performance.now());
	useFrame(() => {
		if (!material.current) return;
		// Written to the material's own inputs, not the object handed to it: the renderer copies plain
		// numbers out of that object once, so changing them there afterwards never reached the screen,
		// and the field sat frozen (MISTAKES M40). The colors only worked because they are shared objects.
		const live = material.current.uniforms as typeof uniforms;
		const now = performance.now();
		const delta =
			lastFrame.current === undefined ? Number.POSITIVE_INFINITY : (now - lastFrame.current) / 1000;
		lastFrame.current = now;
		// Weather eases in over about half a minute; lightning is instant. The first frame starts where
		// the weather already is, so a page opened in snow opens snowing.
		const ease = Math.min(1, delta / 8);
		live.uSnow.value += (weather.snow - live.uSnow.value) * ease;
		live.uCloud.value += (weather.cloud - live.uCloud.value) * ease;
		live.uFog.value += (weather.fog - live.uFog.value) * ease;
		live.uFlash.value = flash.current;
		// Reduced motion freezes the clock rather than removing the field, so the picture is the same.
		live.uTime.value = still ? 0 : (now - started.current) / 1000;
		live.uResolution.value.set(size.width, size.height);
		live.NIGHT.value.copy(vector(palette.night));
		live.OLIVE.value.copy(vector(palette.top));
		live.SLATE.value.copy(vector(palette.upper));
		live.FOG.value.copy(vector(palette.middle));
		live.AMBER.value.copy(vector(palette.glow));
	});

	return (
		// Not culled: the vertex shader ignores the camera, so three would cull against the wrong place.
		<mesh frustumCulled={false}>
			<planeGeometry args={[2, 2]} />
			<shaderMaterial
				ref={material}
				uniforms={uniforms}
				vertexShader={VERTEX}
				fragmentShader={FRAGMENT}
			/>
		</mesh>
	);
}

/** The canvas the city is drawn on, for the glass in front of it to refract. */
export const fogCanvas: { current: HTMLCanvasElement | undefined } = { current: undefined };

/** `fixed` fills the screen; `absolute` fills the nearest positioned parent, for a panel. */
export function FogBackground({
	position = "fixed",
	mode = "dark",
	sky,
	weather = CLEAR,
}: {
	position?: "fixed" | "absolute";
	mode?: Mode;
	/** A palette to draw instead of the city's, for the dynamic theme's sky. */
	sky?: Palette | undefined;
	/** The weather in the city. Clear unless told otherwise. */
	weather?: Weather;
} = {}) {
	const palette = sky ?? CITY[mode];
	const still =
		typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

	return (
		<div
			aria-hidden="true"
			// z-0, not negative: with no stacking context above it, a negative one hides behind the body.
			className={`fog-field pointer-events-none ${position} inset-0 z-0`}
			// The same light in CSS, holding the screen while WebGL starts and standing in without it.
			style={{
				background: `radial-gradient(ellipse at 90% 55%, ${css(palette.glow)} 0%, transparent 40%), linear-gradient(in oklab to bottom, ${css(palette.top)} 0%, ${css(palette.upper)} 33%, ${css(palette.middle)} 50%, ${css(palette.night)} 85%)`,
			}}
		>
			<Canvas
				linear
				flat
				// A quarter of the screen's pixels on a Retina display, upscaled. Fog is soft by nature, so the
				// difference cannot be seen, and it is sixteen times less work than full resolution. At full
				// resolution and sixty frames it kept a laptop's fans running flat out (2026-09-28).
				dpr={0.5}
				frameloop="demand"
				// Kept after each frame, so the rain on the glass can take the city as its background.
				gl={{ antialias: false, alpha: true, preserveDrawingBuffer: true }}
				onCreated={({ gl }) => {
					fogCanvas.current = gl.domElement;
				}}
				style={{ width: "100%", height: "100%" }}
			>
				<Fog still={still} palette={palette} weather={weather} />
			</Canvas>
		</div>
	);
}
