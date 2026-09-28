import type { MachineSummary, RecordEntry } from "./machines.ts";
import { tradesFrom } from "./trades.ts";

/**
 * Maschina's operating picture as objects and the links between them: your wallet, each machine's
 * wallet, each machine's vault, and the tokens they trade. Every link is a path money can take, and every
 * path leads back to the owner, which is the harness drawn as a picture.
 */

type Kind = "wallet" | "machine" | "vault" | "token";
export type Node = {
	id: string;
	kind: Kind;
	code: string;
	label: string;
	address?: string;
	machineId?: string;
};
type Link = { from: string; to: string; kind: "funds" | "banks" | "trades"; count: number };
export type Graph = { nodes: Node[]; links: Link[] };

const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const SOL = "So11111111111111111111111111111111111111112";

/** The vault a machine was made with, from its record. */
export function vaultOf(record: RecordEntry[]): string | undefined {
	const created = record.find((entry) => entry.type === "machine.created");
	const vault = created?.payload["vaultAddress"];
	return typeof vault === "string" ? vault : undefined;
}

export function buildGraph(
	owner: string | undefined,
	machines: { machine: MachineSummary; record: RecordEntry[] }[],
): Graph {
	const nodes: Node[] = [];
	const links: Link[] = [];
	if (owner)
		nodes.push({
			id: "owner",
			kind: "wallet",
			code: "WLT_OWN",
			label: "YOUR WALLET",
			address: owner,
		});
	nodes.push({ id: "usdc", kind: "token", code: "TKN_USDC", label: "USDC", address: USDC });
	nodes.push({ id: "sol", kind: "token", code: "TKN_SOL", label: "SOL", address: SOL });

	machines.forEach(({ machine, record }, index) => {
		const n = String(index + 1).padStart(2, "0");
		const id = `m:${machine.machineId}`;
		nodes.push({
			id,
			kind: "machine",
			code: `MCH_${n}`,
			label: machine.name.toUpperCase(),
			address: machine.walletAddress,
			machineId: machine.machineId,
		});
		if (owner) links.push({ from: "owner", to: id, kind: "funds", count: 1 });
		const vault = vaultOf(record);
		if (vault) {
			const vid = `v:${machine.machineId}`;
			nodes.push({
				id: vid,
				kind: "vault",
				code: `VLT_${n}`,
				label: `VAULT ${n}`,
				address: vault,
				machineId: machine.machineId,
			});
			const sweeps = record.filter((entry) => entry.type === "sweep.completed").length;
			links.push({ from: id, to: vid, kind: "banks", count: sweeps });
		}
		const trades = tradesFrom(record);
		if (trades.length > 0) {
			links.push({ from: id, to: "sol", kind: "trades", count: trades.length });
			links.push({ from: id, to: "usdc", kind: "trades", count: trades.length });
		}
	});
	return { nodes, links };
}

/** Where each node sits: the owner in the middle, machines on a ring, vaults further out, tokens to the right. */
export function layout(
	graph: Graph,
	width: number,
	height: number,
): Map<string, { x: number; y: number }> {
	const at = new Map<string, { x: number; y: number }>();
	const cx = width * 0.42;
	const cy = height / 2;
	const ring = Math.min(width, height) * 0.27;
	at.set("owner", { x: cx, y: cy });
	at.set("sol", { x: width * 0.9, y: cy - height * 0.16 });
	at.set("usdc", { x: width * 0.9, y: cy + height * 0.16 });
	const machines = graph.nodes.filter((node) => node.kind === "machine");
	machines.forEach((node, index) => {
		const angle = -Math.PI / 2 + (index / Math.max(1, machines.length)) * Math.PI * 2;
		at.set(node.id, { x: cx + Math.cos(angle) * ring, y: cy + Math.sin(angle) * ring });
		at.set(`v:${node.machineId}`, {
			x: cx + Math.cos(angle) * ring * 1.55,
			y: cy + Math.sin(angle) * ring * 1.55,
		});
	});
	return at;
}
