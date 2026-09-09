/**
 * The node agent. `06-NODES` §2.
 *
 * Everything in Stage 0 ran because a proof ran it. Nothing was alive between
 * commands: no process held a lease, nothing noticed one expiring, nothing
 * picked work up. This is that gap closed, and it is the slice every other
 * Stage 1 slice needs to exist first.
 *
 * **It decides nothing.** It supervises workers, wakes what is due, and stops
 * cleanly. Scheduling is not judgment, and a daemon that starts making decisions
 * becomes the place logic hides from the log.
 *
 * **A lease is per worker, not per process** (`03-RUNTIME` §4). Several workers
 * run here, each holding its own lease at its own epoch, each writing through
 * its own port. One being fenced stops that one and nothing else.
 *
 * **It cannot reach the database.** Same rule as the worker, checked in CI by
 * `.github/ci/check-node-boundary.mjs`. This is the process the boundary exists
 * to bound: a daemon on somebody's machine, whose only route to anything durable
 * is asking.
 */

import type { ControlPlane } from "@maschina/worker";

import { type StayAwake, stayAwake } from "./stay-awake.ts";
import { WorkerSlot } from "./worker-slot.ts";

export interface DaemonOptions {
	readonly controlPlaneUrl: string;
	/** Which machine this is. `06-NODES` §2 gives a node an identity at slice 3b. */
	readonly node: string;
	/**
	 * The workers this node runs, by name.
	 *
	 * Named rather than counted, because a worker is a principal in the log and
	 * generated names would make it unreadable. Three names means three leases
	 * and three objectives at once.
	 */
	readonly workers: readonly string[];
	readonly leaseTtlMs?: number;
	readonly renewEveryMs?: number;
	readonly pollEveryMs?: number;
	/** What to do with an objective. Injected, so the daemon holds no judgment. */
	readonly run: (objective: string, plane: ControlPlane) => Promise<void>;
	readonly log?: (line: string) => void;
	/**
	 * Hold the machine awake while work is in flight. Opt in.
	 *
	 * Prevents idle sleep, not sleep from closing a laptop lid. See
	 * `stay-awake.ts`, which is honest about what each platform can promise.
	 */
	readonly keepAwake?: boolean;
}

/** Something waiting, and what would start it again. */
export interface Waiting {
	readonly worker: string;
	readonly objective: string | null;
	readonly kind: string;
	readonly reason: string;
	readonly resumeAt: string | null;
	readonly question: string | null;
}

export class Daemon {
	private readonly slots: WorkerSlot[] = [];
	private readonly awake: StayAwake;
	private readonly leaseTtlMs: number;
	private readonly renewEveryMs: number;
	private readonly pollEveryMs: number;
	private running = false;
	private stopping = false;
	private finished: Promise<void> = Promise.resolve();

	constructor(private readonly options: DaemonOptions) {
		this.leaseTtlMs = options.leaseTtlMs ?? 30_000;
		this.renewEveryMs = options.renewEveryMs ?? 10_000;
		this.pollEveryMs = options.pollEveryMs ?? 1_000;
		this.awake = stayAwake(options.keepAwake ?? false, (line) => this.say(line));
	}

	private say(line: string): void {
		(this.options.log ?? console.log)(`[${this.options.node}] ${line}`);
	}

	/** The epoch of one worker's lease, for anything that needs to check. */
	epochOf(worker: string): bigint {
		return this.slots.find((s) => s.worker === worker)?.epoch ?? 0n;
	}

	/** What each worker is doing right now, without asking the log. */
	get busy(): { worker: string; objective: string | null }[] {
		return this.slots.map((s) => ({ worker: s.worker, objective: s.busyWith }));
	}

	/**
	 * Anything whose stated time has arrived.
	 *
	 * Asked of the control plane rather than worked out here, because whether a
	 * suspension is due depends on why it was suspended, and that lives with the
	 * log. A worker waiting on a person is never due, however long it waits.
	 */
	private async dueToResume(): Promise<Waiting[]> {
		const response = await fetch(`${this.options.controlPlaneUrl}/suspensions?due=1`);
		if (!response.ok) return [];
		return (await response.json()) as Waiting[];
	}

	/**
	 * Wake anything whose time has come.
	 *
	 * The first thing in Maschina that acts on a clock rather than on an event.
	 * It only ever acts on a time somebody wrote down: nothing here decides when
	 * a limit lifts, it only notices that a stated moment has passed.
	 */
	private async wakeWhatIsDue(): Promise<void> {
		for (const waiting of await this.dueToResume()) {
			this.say(`${waiting.worker} is due to carry on: ${waiting.reason}`);
			await fetch(
				`${this.options.controlPlaneUrl}/suspensions/${encodeURIComponent(waiting.worker)}/resume`,
				{
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({
						because: `the time it was waiting for arrived (${waiting.resumeAt})`,
						objective: waiting.objective,
					}),
				},
			).catch(() => undefined);
		}
	}

	async start(): Promise<void> {
		if (this.running) return;
		this.running = true;
		this.stopping = false;

		for (const worker of this.options.workers) {
			const slot = new WorkerSlot({
				controlPlaneUrl: this.options.controlPlaneUrl,
				node: this.options.node,
				worker,
				leaseTtlMs: this.leaseTtlMs,
				renewEveryMs: this.renewEveryMs,
				run: this.options.run,
				say: (line) => this.say(line),
			});
			await slot.start();
			this.slots.push(slot);
		}

		this.finished = this.loop();
	}

	private async loop(): Promise<void> {
		this.say(`${this.slots.length} worker(s) looking for work`);
		while (!this.stopping) {
			await this.wakeWhatIsDue().catch(() => undefined);

			// Every slot looks at once. They are separate workers with separate
			// leases, so nothing here serialises them: if two can both claim the
			// same objective, that is a real problem and it should surface.
			const worked = await Promise.all(this.slots.map((slot) => slot.tick()));

			if (worked.some(Boolean)) {
				this.awake.hold("work is in flight");
			} else {
				this.awake.release();
				await new Promise((resolve) => setTimeout(resolve, this.pollEveryMs));
			}

			if (this.slots.every((slot) => slot.fenced)) {
				this.say("every worker was fenced, stopping");
				this.stopping = true;
			}
		}
	}

	/**
	 * Stop, and give every lease back.
	 *
	 * Releasing rather than letting them expire is the difference between a
	 * machine that shut down and a machine that vanished.
	 */
	async stop(reason = "shutting down"): Promise<void> {
		if (!this.running) return;
		this.stopping = true;
		await this.finished;
		this.awake.release();
		await Promise.all(this.slots.map((slot) => slot.stop(reason)));
		this.running = false;
		this.say(`stopped: ${reason}`);
	}
}
