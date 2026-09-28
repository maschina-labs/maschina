import { amount, type MachineSummary } from "./machines.ts";

/**
 * What the manager would suggest, worked out from each machine's own figures by plain rules. The AI
 * manager takes over writing these later, inside the same harness: it suggests, you decide, and anything
 * touching money is signed by you.
 */

export type Suggestion = {
	id: string;
	machineId: string;
	machine: string;
	title: string;
	detail: string;
};

type Band = { buy: number; sell: number };

export function suggestionsFor(
	machines: (MachineSummary & { band?: Band | undefined })[],
	price: number | undefined,
): Suggestion[] {
	const out: Suggestion[] = [];
	for (const machine of machines) {
		const name = machine.name.toUpperCase();
		if (machine.state === "stopped") {
			out.push({
				id: `${machine.machineId}-stopped`,
				machineId: machine.machineId,
				machine: name,
				title: "IT IS STOPPED",
				detail: "WITHDRAW WHAT IT HOLDS, OR RETIRE IT ONCE IT IS EMPTY",
			});
			continue;
		}
		if (price !== undefined && machine.band) {
			const { buy, sell } = machine.band;
			if (price > sell * 1.01 || price < buy * 0.99) {
				out.push({
					id: `${machine.machineId}-band`,
					machineId: machine.machineId,
					machine: name,
					title: "THE PRICE HAS LEFT ITS BAND",
					detail: `SOL IS ${price.toFixed(2)}, ITS BAND IS ${buy.toFixed(2)} TO ${sell.toFixed(2)} · RETUNE IT, OR SWITCH TO A RANGE FINDER`,
				});
			}
		}
		const position = BigInt(machine.result.position);
		const basis = BigInt(machine.result.basis);
		if (price !== undefined && position > 0n && basis > 0n) {
			// What it paid per SOL: basis in USDC (six decimals) over position in SOL (nine).
			const paid = (Number(basis) / Number(position)) * 1000;
			const down = (paid - price) / paid;
			if (down > 0.005) {
				out.push({
					id: `${machine.machineId}-down`,
					machineId: machine.machineId,
					machine: name,
					title: `DOWN ${(down * 100).toFixed(1)}% ON WHAT IT HOLDS`,
					detail: `PAID ${paid.toFixed(2)}, SOL IS ${price.toFixed(2)} · HOLDING ${amount(machine.result.position, 9)} SOL WITH NO FLOOR`,
				});
			}
		}
	}
	return out;
}
