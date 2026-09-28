import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ShaderMaterial } from "three";
import { Vector2, Vector3 } from "three";

/**
 * The field behind the terminal: city light through a fogged window, far out of focus. Dark olive at
 * the top, a slate blue haze across the upper middle, warm grey fog through the centre, amber glowing
 * on the right, near black at the bottom. Each patch is shaped by slow rolling noise, so it breathes.
 *
 * Colours are chosen in OKLCH and mixed in OKLab, where equal steps look equal, so the glows fade into
 * the dark without the muddy rings plain RGB leaves around a soft light.
 */

type Oklch = { l: number; c: number; h: number };

/** The fog's five colours: the dark, the top, the upper haze, the middle fog, and the one glow. */
export type Palette = { night: Oklch; top: Oklch; upper: Oklch; middle: Oklch; glow: Oklch };

/**
 * Palettes to try the app in. City is measured from Ash's Obsidian reference (2026-09-28), region by region;
 * the others keep its shape and change its light. Chosen with `?fog=name` on any address.
 */
const PALETTES = {
	city: {
		night: { l: 0.16, c: 0.002, h: 286 },
		top: { l: 0.246, c: 0.021, h: 136 },
		upper: { l: 0.367, c: 0.021, h: 232 },
		middle: { l: 0.405, c: 0.012, h: 72 },
		glow: { l: 0.471, c: 0.047, h: 77 },
	},
	gunmetal: {
		night: { l: 0.14, c: 0.003, h: 250 },
		top: { l: 0.2, c: 0.01, h: 250 },
		upper: { l: 0.3, c: 0.015, h: 245 },
		middle: { l: 0.34, c: 0.008, h: 240 },
		glow: { l: 0.42, c: 0.012, h: 235 },
	},
	ember: {
		night: { l: 0.12, c: 0.004, h: 40 },
		top: { l: 0.16, c: 0.01, h: 40 },
		upper: { l: 0.22, c: 0.03, h: 45 },
		middle: { l: 0.3, c: 0.04, h: 50 },
		glow: { l: 0.5, c: 0.1, h: 55 },
	},
	lavender: {
		night: { l: 0.13, c: 0.006, h: 290 },
		top: { l: 0.2, c: 0.02, h: 295 },
		upper: { l: 0.32, c: 0.04, h: 290 },
		middle: { l: 0.36, c: 0.02, h: 300 },
		glow: { l: 0.46, c: 0.06, h: 305 },
	},
	ink: {
		night: { l: 0.1, c: 0, h: 0 },
		top: { l: 0.15, c: 0, h: 0 },
		upper: { l: 0.22, c: 0, h: 0 },
		middle: { l: 0.28, c: 0, h: 0 },
		glow: { l: 0.36, c: 0, h: 0 },
	},
	arctic: {
		night: { l: 0.14, c: 0.006, h: 230 },
		top: { l: 0.22, c: 0.015, h: 220 },
		upper: { l: 0.38, c: 0.03, h: 225 },
		middle: { l: 0.44, c: 0.015, h: 215 },
		glow: { l: 0.56, c: 0.03, h: 210 },
	},
} satisfies Record<string, Palette>;
export type PaletteName = keyof typeof PALETTES;

/** The palette asked for in the address, or the one last chosen here, or city. */
export function paletteName(search: string, remembered: string | null): PaletteName {
	const asked = new URLSearchParams(search).get("fog");
	for (const name of [asked, remembered]) if (name && name in PALETTES) return name as PaletteName;
	return "city";
}

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

		// Dark at the edges, as an out of focus lens is.
		vec2 centred = vUv - 0.5;
		color.x *= mix(1.0, 0.72, smoothstep(0.25, 0.75, length(centred * vec2(1.1, 1.0))));

		// A whisper of dither, so the long dark fades never band on an 8-bit screen.
		color.x += (hash(vec3(floor(gl_FragCoord.xy), mod(floor(uTime * 12.0), 16.0))) - 0.5) * 0.004;

		gl_FragColor = vec4(toScreen(color), 1.0);
	}
`;

function Fog({ still, palette }: { still: boolean; palette: Palette }) {
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

	useFrame(({ clock }) => {
		if (!material.current) return;
		// Reduced motion freezes the clock rather than removing the field, so the picture is the same.
		uniforms.uTime.value = still ? 0 : clock.getElapsedTime();
		uniforms.uResolution.value.set(size.width, size.height);
		uniforms.NIGHT.value.copy(vector(palette.night));
		uniforms.OLIVE.value.copy(vector(palette.top));
		uniforms.SLATE.value.copy(vector(palette.upper));
		uniforms.FOG.value.copy(vector(palette.middle));
		uniforms.AMBER.value.copy(vector(palette.glow));
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

/** `fixed` fills the screen; `absolute` fills the nearest positioned parent, for a panel. */
export function FogBackground({ position = "fixed" }: { position?: "fixed" | "absolute" } = {}) {
	// Remembered in this browser for convenience only: it may be missing or blocked, and city is the default.
	const [palette] = useState<Palette>(() => {
		let remembered: string | null = null;
		try {
			remembered = localStorage.getItem("maschina.fog");
		} catch {}
		const name = paletteName(window.location.search, remembered);
		try {
			localStorage.setItem("maschina.fog", name);
		} catch {}
		return PALETTES[name];
	});
	const still =
		typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

	return (
		<div
			aria-hidden="true"
			// z-0, not negative: with no stacking context above it, a negative one hides behind the body.
			className={`pointer-events-none ${position} inset-0 z-0`}
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
				gl={{ antialias: false, alpha: true }}
				style={{ width: "100%", height: "100%" }}
			>
				<Fog still={still} palette={palette} />
			</Canvas>
		</div>
	);
}
