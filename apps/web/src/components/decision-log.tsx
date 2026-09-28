import { describeEvent } from "../lib/describe.ts";
import type { RecordEntry } from "../lib/machines.ts";

/**
 * The machine's decisions as a log, newest first, one line each: when, a short code for what, and the
 * reason in words. The micrographic codes make it read like a system's own record, which is what it is.
 */

const CODES: Record<string, string> = {
	"machine.created": "MCH_NEW",
	"machine.started": "MCH_RUN",
	"machine.paused": "MCH_PSE",
	"machine.resumed": "MCH_RES",
	"machine.stopped": "MCH_STP",
	"machine.limits_changed": "LIM_SET",
	"run.queued": "RUN_WAK",
	"run.started": "RUN_GO",
	"run.skipped": "RUN_NIL",
	"run.finished": "RUN_END",
	"trade.intended": "TRD_INT",
	"trade.submitted": "TRD_SNT",
	"trade.completed": "TRD_OK",
	"trade.failed": "TRD_ERR",
	"trade.refused": "TRD_NO",
	"sweep.completed": "VLT_IN",
	"withdrawal.completed": "WDR_OK",
};

export const codeOf = (type: string) =>
	CODES[type] ?? type.replace(".", "_").toUpperCase().slice(0, 7);

export function DecisionLog({ record, limit = 12 }: { record: RecordEntry[]; limit?: number }) {
	const latest = [...record].reverse().slice(0, limit);
	if (latest.length === 0) return null;
	return (
		<section aria-label="Decision log" className="flex flex-col gap-2">
			<h2 className="text-[10.5px] text-neutral-500 tracking-[0.14em]">{"LOG // NEWEST FIRST"}</h2>
			<ol className="flex flex-col">
				{latest.map((entry) => {
					const said = describeEvent(entry);
					return (
						<li
							key={entry.id}
							className="grid grid-cols-[auto_auto_auto_1fr] items-baseline gap-4 border-white/[0.05] border-b py-1.5 text-[10.5px] tracking-[0.1em]"
						>
							<time className="text-neutral-600 tabular-nums" dateTime={entry.occurredAt}>
								{new Date(entry.occurredAt).toLocaleTimeString("en-CA", { hour12: false })}
							</time>
							<span className="w-16 text-neutral-500">{codeOf(entry.type)}</span>
							<span className="text-neutral-100">{said.title}</span>
							<span className="truncate text-neutral-500">
								{said.detail ? `// ${said.detail}` : ""}
							</span>
						</li>
					);
				})}
			</ol>
		</section>
	);
}
