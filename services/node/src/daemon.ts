/**
 * The node agent. `06-NODES` §2.
 *
 * Everything in Stage 0 ran because a proof ran it. Nothing was alive between
 * commands: no process held a lease, nothing noticed one expiring, nothing
 * picked work up. This is that gap closed, and it is the slice every other
 * Stage 1 slice needs to exist first.
 *
 * **It decides nothing.** It holds a lease, looks for work, hands each objective
 * to a worker loop, and stops cleanly. Scheduling is not judgment, and a daemon
 * that starts making decisions becomes the place logic hides from the log.
 *
 * **It cannot reach the database.** Same rule as the worker, checked in CI by
 * `.github/ci/check-node-boundary.mjs`. This is the process the boundary exists
 * to bound: a daemon on somebody's machine, whose only route to anything durable
 * is asking.
 */

import type { ControlPlane } from "@maschina/worker";
import { httpControlPlane, WorkerFenced } from "@maschina/worker";
import { type StayAwake, stayAwake } from "./stay-awake.ts";

export interface DaemonOptions {
	readonly controlPlaneUrl: string;
	/** Which machine this is. `06-NODES` §2 gives a node an identity at slice 3b. */
	readonly node: string;
	/** Which worker this daemon runs. One worker per daemon at Stage 1. */
	readonly worker: string;
	/** How long a lease lasts before it is somebody else's to take. */
	readonly leaseTtlMs?: number;
	/** How often to renew, which must be comfortably inside the TTL. */
	readonly renewEveryMs?: number;
	/** How often to look for work when there is none. */
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

export interface Objective {
	readonly id: string;
	readonly state: string;
}

/**
 * A daemon that stays up.
 *
 * Started, it takes a lease and keeps it. Stopped, it gives the lease back
 * rather than leaving one to expire, so the next holder does not have to wait
 * out a TTL for a machine that shut down politely.
 */
export class Daemon {
	private readonly options: Required<Omit<DaemonOptions, "run" | "log" | "keepAwake">> &
		Pick<DaemonOptions, "run" | "log" | "keepAwake">;
	private plane: ControlPlane;
	private readonly awake: StayAwake;
	private epoch = 0n;
	private renewTimer: NodeJS.Timeout | null = null;
	private running = false;
	private stopping = false;
	/** Resolves when the loop has actually stopped, so shutdown can wait for it. */
	private finished: Promise<void> = Promise.resolve();

	constructor(options: DaemonOptions) {
		this.options = {
			leaseTtlMs: 30_000,
			renewEveryMs: 10_000,
			pollEveryMs: 1_000,
			...options,
			node: options.node,
			worker: options.worker,
			controlPlaneUrl: options.controlPlaneUrl,
		};
		this.plane = httpControlPlane(options.controlPlaneUrl);
		this.awake = stayAwake(options.keepAwake ?? false, (line) => this.say(line));
	}

	private say(line: string): void {
		(this.options.log ?? console.log)(`[${this.options.node}] ${line}`);
	}

	/** Take the lease, and rebuild the port so every write carries its epoch. */
	private async takeLease(): Promise<void> {
		const response = await fetch(`${this.options.controlPlaneUrl}/leases`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				worker: this.options.worker,
				node: this.options.node,
				ttlMs: this.options.leaseTtlMs,
			}),
		});
		if (!response.ok) throw new Error(`could not take a lease: ${response.status}`);

		const lease = (await response.json()) as { epoch: string };
		this.epoch = BigInt(lease.epoch);
		// A port is a lease generation. Rebuilding it here means every write this
		// daemon makes carries the epoch without any call site remembering to.
		this.plane = httpControlPlane(this.options.controlPlaneUrl, this.epoch);
		this.say(`holding the lease on ${this.options.worker} at epoch ${this.epoch}`);
	}

	private async renewLease(): Promise<void> {
		const response = await fetch(
			`${this.options.controlPlaneUrl}/leases/${encodeURIComponent(this.options.worker)}/renew`,
			{
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					node: this.options.node,
					epoch: this.epoch.toString(),
					ttlMs: this.options.leaseTtlMs,
				}),
			},
		);
		if (response.status === 409) {
			// Somebody else holds it now. There is nothing to retry: this daemon
			// is a ghost and the correct response is to stop, the same one the
			// worker takes when the log fences a write.
			throw new WorkerFenced(this.options.worker, this.epoch, "the lease was reassigned");
		}
		if (!response.ok) throw new Error(`could not renew the lease: ${response.status}`);
	}

	private async releaseLease(reason: string): Promise<void> {
		await fetch(
			`${this.options.controlPlaneUrl}/leases/${encodeURIComponent(this.options.worker)}/release`,
			{
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ reason }),
			},
		).catch(() => undefined);
	}

	/**
	 * What is there to do?
	 *
	 * Admitted objectives, oldest first. Deliberately not "objectives assigned to
	 * me": assignment is placement, and placement is Stage 2. At Stage 1 there is
	 * one node and it takes what it finds.
	 */
	private async findWork(): Promise<string | null> {
		const response = await fetch(`${this.options.controlPlaneUrl}/objectives?state=admitted`);
		if (!response.ok) return null;
		const objectives = (await response.json()) as Objective[];
		return objectives[0]?.id ?? null;
	}

	/** Claim an objective, or find out somebody else has it. */
	private async claim(objective: string): Promise<boolean> {
		const response = await fetch(
			`${this.options.controlPlaneUrl}/objectives/${encodeURIComponent(objective)}/take`,
			{
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					worker: this.options.worker,
					node: this.options.node,
					epoch: this.epoch.toString(),
				}),
			},
		);
		return response.ok;
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
	 * This is the first thing in Maschina that acts on a clock rather than on an
	 * event, which is a genuinely new kind of thing. It only ever acts on a time
	 * somebody wrote down: nothing here decides when a limit lifts, it only
	 * notices that a stated moment has passed.
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

		await this.takeLease();
		this.renewTimer = setInterval(() => {
			this.renewLease().catch((error: unknown) => {
				this.say(`lost the lease: ${error instanceof Error ? error.message : String(error)}`);
				void this.stop("the lease was lost");
			});
		}, this.options.renewEveryMs);

		this.finished = this.loop();
	}

	private async loop(): Promise<void> {
		this.say("looking for work");
		while (!this.stopping) {
			// Before looking for new work, carry on with anything that was waiting
			// for a time that has now arrived.
			await this.wakeWhatIsDue().catch(() => undefined);

			let objective: string | null = null;
			try {
				objective = await this.findWork();
			} catch (error: unknown) {
				this.say(`could not look for work: ${error instanceof Error ? error.message : error}`);
			}

			if (objective === null) {
				// Nothing to do, so nothing to stay awake for.
				this.awake.release();
				await new Promise((resolve) => setTimeout(resolve, this.options.pollEveryMs));
				continue;
			}

			// Claim it before running it. Without this the daemon finds the same
			// objective every time it looks, takes it again, and never reaches the
			// second one. Found by running a daemon for four seconds.
			//
			// Losing the claim is ordinary: another node got there first, so this
			// one looks again rather than treating it as a failure.
			if (!(await this.claim(objective))) {
				this.say(`${objective} was taken by somebody else`);
				continue;
			}

			this.say(`taking ${objective}`);
			// Held only while there is work. A node that kept a machine awake
			// while idle would be taking something it was not given.
			this.awake.hold(`running ${objective}`);
			try {
				await this.options.run(objective, this.plane);
				this.say(`finished ${objective}`);
			} catch (error: unknown) {
				if (error instanceof WorkerFenced) {
					this.say("fenced, stopping");
					this.stopping = true;
					return;
				}
				// An objective that failed is a recorded outcome, not a reason to
				// take the machine down. The daemon keeps going; the objective's
				// own state says what happened to it.
				this.say(
					`${objective} did not finish: ${error instanceof Error ? error.message : error}`,
				);
			}
		}
	}

	/**
	 * Stop, and give the lease back.
	 *
	 * Releasing rather than letting it expire is the difference between a machine
	 * that shut down and a machine that vanished. The next holder should not wait
	 * out a TTL for the first case.
	 */
	async stop(reason = "shutting down"): Promise<void> {
		if (!this.running) return;
		this.stopping = true;
		if (this.renewTimer !== null) {
			clearInterval(this.renewTimer);
			this.renewTimer = null;
		}
		await this.finished;
		this.awake.release();
		await this.releaseLease(reason);
		this.running = false;
		this.say(`stopped: ${reason}`);
	}

	get currentEpoch(): bigint {
		return this.epoch;
	}
}
