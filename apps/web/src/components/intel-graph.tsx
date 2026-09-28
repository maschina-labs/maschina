import { type Graph, type Kind, layout } from "../lib/intel.ts";

/**
 * The money-flow graph: your wallet in the middle as a double ring, machines around it as hexagons, each
 * vault beside its machine as a square, and the tokens as diamonds. Dashed wires are the paths money can
 * take; small lights travel the ones that have carried trades. Every wire leads back to you.
 */

const W = 1000;
const H = 620;

function Shape({ kind, x, y, lit }: { kind: Kind; x: number; y: number; lit: boolean }) {
	const stroke = `oklch(1 0 0 / ${lit ? 0.95 : 0.55})`;
	const fill = `oklch(0.1 0 0 / ${lit ? 0.9 : 0.7})`;
	if (kind === "wallet")
		return (
			<g>
				<circle cx={x} cy={y} r={26} fill={fill} stroke={stroke} />
				<circle cx={x} cy={y} r={19} fill="none" stroke={stroke} strokeDasharray="2 3" />
			</g>
		);
	if (kind === "machine") {
		const r = 18;
		const points = Array.from({ length: 6 }, (_, i) => {
			const a = (Math.PI / 3) * i + Math.PI / 6;
			return `${x + r * Math.cos(a)},${y + r * Math.sin(a)}`;
		}).join(" ");
		return <polygon points={points} fill={fill} stroke={stroke} />;
	}
	if (kind === "vault")
		return <rect x={x - 11} y={y - 11} width={22} height={22} fill={fill} stroke={stroke} />;
	return (
		<polygon
			points={`${x},${y - 14} ${x + 14},${y} ${x},${y + 14} ${x - 14},${y}`}
			fill={fill}
			stroke={stroke}
		/>
	);
}

export function IntelGraph({
	graph,
	selected,
	onSelect,
}: {
	graph: Graph;
	selected: string | undefined;
	onSelect: (id: string) => void;
}) {
	const at = layout(graph, W, H);
	return (
		<svg
			viewBox={`0 0 ${W} ${H}`}
			role="img"
			aria-label="Money flow graph"
			className="h-full w-full select-none"
		>
			{/* Faint rings, like a radar's range markers. */}
			{[0.27, 0.42].map((r) => (
				<circle
					key={r}
					cx={W * 0.42}
					cy={H / 2}
					r={Math.min(W, H) * r}
					fill="none"
					stroke="oklch(1 0 0 / 0.05)"
					strokeDasharray="1 6"
				/>
			))}
			{graph.links.map((link) => {
				const a = at.get(link.from);
				const b = at.get(link.to);
				if (!a || !b) return null;
				const lit = selected === link.from || selected === link.to;
				const path = `M ${a.x} ${a.y} Q ${(a.x + b.x) / 2} ${(a.y + b.y) / 2 - 30} ${b.x} ${b.y}`;
				return (
					<g key={`${link.from}-${link.to}`}>
						<path
							d={path}
							fill="none"
							stroke={`oklch(1 0 0 / ${lit ? 0.55 : 0.18})`}
							strokeDasharray={link.kind === "funds" ? "3 5" : "1 4"}
						/>
						{link.count > 0 ? (
							<>
								<circle r={2} fill="oklch(0.97 0 0)">
									<animateMotion dur={`${6 + link.count}s`} repeatCount="indefinite" path={path} />
								</circle>
								<text
									x={(a.x + b.x) / 2}
									y={(a.y + b.y) / 2 - 22}
									textAnchor="middle"
									fill="oklch(1 0 0 / 0.4)"
									fontSize={9}
									letterSpacing={1.2}
								>
									{link.kind === "trades" ? `${link.count} TRD` : `${link.count} SWP`}
								</text>
							</>
						) : null}
					</g>
				);
			})}
			{graph.nodes.map((node) => {
				const p = at.get(node.id);
				if (!p) return null;
				const lit = node.id === selected;
				return (
					// biome-ignore lint/a11y/useSemanticElements: an SVG group cannot be a button element
					<g
						key={node.id}
						role="button"
						tabIndex={0}
						aria-label={`${node.code} ${node.label}`}
						aria-pressed={lit}
						onClick={() => onSelect(node.id)}
						onKeyDown={(event) => event.key === "Enter" && onSelect(node.id)}
						className="cursor-pointer outline-none"
					>
						<Shape kind={node.kind} x={p.x} y={p.y} lit={lit} />
						<text
							x={p.x}
							y={p.y + 40}
							textAnchor="middle"
							fill={`oklch(1 0 0 / ${lit ? 0.95 : 0.7})`}
							fontSize={10}
							letterSpacing={1.4}
						>
							{node.label}
						</text>
						<text
							x={p.x}
							y={p.y + 53}
							textAnchor="middle"
							fill="oklch(1 0 0 / 0.35)"
							fontSize={8}
							letterSpacing={1.6}
						>
							{node.code}
						</text>
					</g>
				);
			})}
		</svg>
	);
}
