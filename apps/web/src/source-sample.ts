/** A display excerpt from packages/runtime/src/machine-limits.ts in the Maschina source tree. */
const SOURCE = `export function parseList(value: string): string[] {
\tconst seen = new Set<string>();
\tfor (const entry of value.split(",")) {
\t\tconst trimmed = entry.trim();
\t\tif (trimmed) seen.add(trimmed);
\t}
\treturn [...seen];
}

export function machineLimits(events: Iterable<RecordedEvent>): MachineLimits {
\tconst limits: MachineLimits = { approvedMints: [], recipients: [] };

\tfor (const event of events) {
\t\tif (event.type !== "machine.limits_changed") continue;
\t\tconst { limit, to } = event.payload;

\t\tswitch (limit) {
\t\t\tcase "maxPerTrade": {
\t\t\t\tconst amount = parseAmount(to);
\t\t\t\tif (amount === undefined) delete limits.maxPerTrade;
\t\t\t\telse limits.maxPerTrade = amount;
\t\t\t\tbreak;
\t\t\t}
\t\t\tcase "maxPerDay": {
\t\t\t\tconst amount = parseAmount(to);
\t\t\t\tif (amount === undefined) delete limits.maxPerDay;
\t\t\t\telse limits.maxPerDay = amount;
\t\t\t\tbreak;
\t\t\t}
\t\t\tcase "approvedMints":
\t\t\t\tlimits.approvedMints = parseList(to);
\t\t\t\tbreak;
\t\t\tcase "recipients":
\t\t\t\tlimits.recipients = parseList(to);
\t\t\t\tbreak;
\t\t\tcase "maxSlippageBps": {
\t\t\t\tconst bps = parseBps(to);
\t\t\t\tif (bps === undefined) delete limits.maxSlippageBps;
\t\t\t\telse limits.maxSlippageBps = bps;
\t\t\t\tbreak;
\t\t\t}
\t\t\tcase "maxPriceImpactBps": {
\t\t\t\tconst bps = parseBps(to);
\t\t\t\tif (bps === undefined) delete limits.maxPriceImpactBps;
\t\t\t\telse limits.maxPriceImpactBps = bps;
\t\t\t\tbreak;
\t\t\t}
\t\t\tcase "budgetGranted":
\t\t\t\tbreak;
\t\t}
\t}

\treturn limits;
}`;

export type Kind = "comment" | "keyword" | "type" | "string" | "number" | "function" | "plain";

const RULES: [RegExp, Kind][] = [
	[/^\/\/.*/, "comment"],
	[/^"(?:[^"\\]|\\.)*"|^'(?:[^'\\]|\\.)*'/, "string"],
	[
		/^(?:export|function|const|new|for|of|if|continue|return|switch|case|break|else|delete|undefined|typeof)\b/,
		"keyword",
	],
	[/^[A-Z][A-Za-z0-9_]*/, "type"],
	[/^\d+\b/, "number"],
	[/^[A-Za-z_$][A-Za-z0-9_$]*(?=\()/, "function"],
	[/^(?:[A-Za-z_$][A-Za-z0-9_$]*|\s+|.)/, "plain"],
];

function tokenize(line: string): { text: string; kind: Kind }[] {
	const pieces: { text: string; kind: Kind }[] = [];
	let rest = line;
	while (rest.length > 0) {
		for (const [pattern, kind] of RULES) {
			const found = pattern.exec(rest);
			if (!found) continue;
			const text = found[0];
			const last = pieces.at(-1);
			if (kind === "plain" && last?.kind === "plain") last.text += text;
			else pieces.push({ text, kind });
			rest = rest.slice(text.length);
			break;
		}
	}
	return pieces;
}

export const SOURCE_LINES = SOURCE.split("\n").map((line) => tokenize(line));
