import { describeEvent } from "./describe.ts";
import { amount, type MachineDetail, type RecordEntry } from "./machines.ts";
import { statusOf } from "./status.ts";
import { tradesFrom } from "./trades.ts";

/**
 * A machine answering for itself, from its own record and nothing else (D-037): what it did, how it
 * stands, why it last traded. No guessing and no model: a rule based machine can already explain every
 * move it made, because every move is written down.
 */

export const QUESTIONS = [
	"WHAT DID YOU DO?",
	"HOW ARE YOU DOING?",
	"WHY DID YOU LAST TRADE?",
] as const;
export type Question = (typeof QUESTIONS)[number];

const time = (at: string) => new Date(at).toLocaleString("en-CA", { hour12: false });

export function answer(
	question: Question,
	machine: MachineDetail,
	record: RecordEntry[],
): string[] {
	switch (question) {
		case "WHAT DID YOU DO?": {
			const latest = [...record].reverse().slice(0, 5);
			if (latest.length === 0) return ["NOTHING YET. MY RECORD IS EMPTY."];
			return latest.map((entry) => {
				const said = describeEvent(entry);
				return `${time(entry.occurredAt)} · ${said.title}${said.detail ? ` · ${said.detail}` : ""}`;
			});
		}
		case "HOW ARE YOU DOING?":
			return [
				`I AM ${machine.state.toUpperCase()}. ${statusOf(machine)}.`,
				`${machine.result.trades} TRADES SO FAR, ${machine.result.wins} WINS AND ${machine.result.losses} LOSSES.`,
				`REALISED ${amount(machine.result.realised)} USDC. HOLDING ${amount(machine.result.position, 9)} SOL.`,
			];
		case "WHY DID YOU LAST TRADE?": {
			const last = tradesFrom(record).at(-1);
			if (!last) return ["I HAVE NOT TRADED YET."];
			const line = machine.settings[last.side === "buy" ? "buyLevel" : "sellLevel"];
			const level = typeof line === "string" ? amount(line) : undefined;
			const verb = last.side === "buy" ? "BOUGHT" : "SOLD";
			return [
				level
					? `I ${verb} AT ${last.price.toFixed(2)} BECAUSE THE PRICE REACHED MY ${last.side.toUpperCase()} LINE AT ${level}.`
					: `I ${verb} AT ${last.price.toFixed(2)}.`,
				`THAT WAS ${time(new Date(last.at).toISOString())}.`,
			];
		}
	}
}
