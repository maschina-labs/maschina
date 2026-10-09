import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import {
	AdditiveBlending,
	BufferAttribute,
	BufferGeometry,
	Color,
	type Group,
	type InstancedMesh,
	Line,
	LineBasicMaterial,
	Matrix4,
	NormalBlending,
	Vector3,
} from "three";
import { rgbaOf } from "./chart-tone.ts";
import type { Palette } from "./fog-background.tsx";
import type { Tower } from "./types.ts";

/**
 * The towers, after the PlayStation 2's boot screen (Ash's references, 2026-10-04): a tunnel of square
 * pillars standing out of a far wall toward you, pale ends catching the light, the theme's glow pooled in
 * the middle, and a few coloured comets drawing trails through it. On the PS2 each pillar was a save on
 * the memory card; here the brightest, longest pillars are your machines, the rest the tunnel itself.
 *
 * One instanced box for every pillar, so the whole tunnel is a single draw: light on any GPU.
 */

type Oklch = { l: number; c: number; h: number };
const colorOf = ({ l, c, h }: Oklch, lift = 0) => {
	const rgba =
		rgbaOf(`oklch(${Math.min(100, (l + lift) * 100)}% ${c} ${h})`) ?? "rgba(200, 200, 210, 1)";
	const [r, g, b] = (rgba.match(/[\d.]+/g) ?? []).map(Number);
	return new Color((r ?? 200) / 255, (g ?? 200) / 255, (b ?? 210) / 255);
};

const WALL = -28;
const CELL = 1.18;
const COLS = 12;
const ROWS = 8;
/** The open middle of the tunnel, in cells. */
const HOLE = 3.4;

// The same pillars every visit: a small fixed hash rather than chance.
const hash = (x: number, y: number) => {
	const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
	return n - Math.floor(n);
};

type Cell = { x: number; y: number; ring: number };

const CELLS: Cell[] = (() => {
	const cells: Cell[] = [];
	for (let x = -COLS; x <= COLS; x++)
		for (let y = -ROWS; y <= ROWS; y++) {
			const ring = Math.hypot(x, y * 1.15);
			// About half the cells hold a pillar: the tunnel is sparse, so the UI in front stays readable.
			if (ring >= HOLE && hash(x * 3.1, y * 1.7) > 0.46) cells.push({ x, y, ring });
		}
	// Nearest the middle first, so the machines take the places the eye goes to.
	return cells.sort((a, b) => a.ring - b.ring || hash(a.x, a.y) - hash(b.x, b.y));
})();

/** Where each machine stands: spread round the inner ring, not bunched on one side. */
const MACHINE_CELLS = (() => {
	const inner = CELLS.filter((cell) => cell.ring < HOLE + 2.2);
	return inner.sort((a, b) => Math.atan2(a.y, a.x) - Math.atan2(b.y, b.x));
})();

const COMETS = [
	{ color: "#4ade80", radius: 3.1, speed: 0.19, phase: 0, tilt: 0.6 },
	{ color: "#f87171", radius: 4.2, speed: -0.14, phase: 2.1, tilt: -0.4 },
	{ color: "#c084fc", radius: 3.6, speed: 0.12, phase: 4.2, tilt: 0.2 },
	{ color: "#818cf8", radius: 2.7, speed: -0.17, phase: 1.1, tilt: -0.7 },
];
const TRAIL = 36;

export function Towers({
	towers,
	palette,
	still,
}: {
	towers: Tower[];
	palette: Palette;
	still: boolean;
}) {
	const light = palette.night.l > 0.6;
	const mesh = useRef<InstancedMesh>(null);
	const group = useRef<Group>(null);
	const camera = useThree((state) => state.camera);
	const started = useRef(performance.now());

	const colors = useMemo(
		() => ({
			pillar: light ? colorOf(palette.top, -0.1) : colorOf(palette.upper, 0.42),
			machine: light ? colorOf(palette.glow, -0.28) : colorOf(palette.glow, 0.12),
			glow: colorOf(palette.glow, light ? -0.2 : 0),
			fog: colorOf(palette.night, light ? 0 : -0.04),
		}),
		[palette, light],
	);

	// Every pillar's place, length and colour. Machines first, in their cells; the rest fill the tunnel.
	useEffect(() => {
		const instanced = mesh.current;
		if (!instanced) return;
		const matrix = new Matrix4();
		const taken = new Set<Cell>();
		let index = 0;
		const place = (cell: Cell, length: number, color: Color) => {
			matrix.makeScale(0.94, 0.94, length);
			matrix.setPosition(cell.x * CELL, cell.y * CELL, WALL + length / 2);
			instanced.setMatrixAt(index, matrix);
			instanced.setColorAt(index, color);
			index++;
		};
		towers.forEach((tower, i) => {
			const cell =
				MACHINE_CELLS[Math.floor((i / Math.max(towers.length, 1)) * MACHINE_CELLS.length)];
			if (!cell || taken.has(cell)) return;
			taken.add(cell);
			place(
				cell,
				10 + tower.height * 14,
				colors.pillar.clone().lerp(colors.machine, 0.25 + tower.glow * 0.6),
			);
		});
		for (const cell of CELLS) {
			if (taken.has(cell)) continue;
			// Longer the further out, so the tunnel's walls reach past you on every side, as on the PS2.
			const length = Math.min(19, 2 + cell.ring * 1.2 + hash(cell.x, cell.y) * 6);
			// Dim, so the pillars stay behind the glass: only the machines' pillars are bright.
			const shade = (0.32 + hash(cell.y, cell.x) * 0.3) * (light ? 1.6 : 1);
			place(cell, length, colors.pillar.clone().multiplyScalar(shade));
		}
		instanced.count = index;
		instanced.instanceMatrix.needsUpdate = true;
		if (instanced.instanceColor) instanced.instanceColor.needsUpdate = true;
	}, [towers, colors]);

	// The comets and their trails.
	const comets = useMemo(
		() =>
			COMETS.map((comet) => {
				const geometry = new BufferGeometry();
				const positions = new Float32Array(TRAIL * 3);
				const shades = new Float32Array(TRAIL * 3);
				const tint = new Color(comet.color);
				for (let i = 0; i < TRAIL; i++) {
					const fade = (1 - i / TRAIL) ** 1.6;
					shades.set([tint.r * fade, tint.g * fade, tint.b * fade], i * 3);
				}
				geometry.setAttribute("position", new BufferAttribute(positions, 3));
				geometry.setAttribute("color", new BufferAttribute(shades, 3));
				const line = new Line(
					geometry,
					new LineBasicMaterial({
						vertexColors: true,
						transparent: true,
						opacity: light ? 0.7 : 1,
						blending: light ? NormalBlending : AdditiveBlending,
						depthWrite: false,
					}),
				);
				return { ...comet, line, positions };
			}),
		[light],
	);

	useFrame(() => {
		const t = still ? 0 : (performance.now() - started.current) / 1000;
		// The camera drifts and the tunnel turns, slowly, as the boot screen did.
		camera.position.set(Math.sin(t * 0.05) * 0.8, Math.cos(t * 0.04) * 0.5, 3);
		camera.lookAt(0, 0, WALL * 0.6);
		if (group.current) group.current.rotation.z = t * 0.012;
		const point = new Vector3();
		for (const comet of comets) {
			for (let i = 0; i < TRAIL; i++) {
				const at = t * comet.speed - i * 0.012 + comet.phase;
				point.set(
					Math.cos(at) * comet.radius,
					Math.sin(at) * comet.radius * (1 + comet.tilt * 0.3),
					WALL * 0.45 + Math.sin(at * 1.7) * 6,
				);
				comet.positions.set([point.x, point.y, point.z], i * 3);
			}
			const moved = comet.line.geometry.attributes["position"];
			if (moved) moved.needsUpdate = true;
		}
	});

	return (
		<group ref={group}>
			<fog attach="fog" args={[colors.fog, 8, 40]} />
			<ambientLight intensity={light ? 1.1 : 0.35} />
			{/* From behind the viewer, so every pillar's end catches the light and its sides fall away. */}
			<directionalLight position={[0.15, 0.25, 1]} intensity={light ? 1.1 : 1.5} />
			<pointLight
				position={[0, 0, WALL * 0.55]}
				color={colors.glow}
				intensity={light ? 20 : 60}
				distance={34}
			/>
			<instancedMesh ref={mesh} args={[undefined, undefined, CELLS.length]}>
				<boxGeometry args={[CELL, CELL, 1]} />
				<meshStandardMaterial roughness={0.55} metalness={0.15} />
			</instancedMesh>
			{comets.map((comet) => (
				<primitive key={comet.color} object={comet.line} />
			))}
		</group>
	);
}
