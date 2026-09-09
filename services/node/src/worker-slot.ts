/**
 * One worker, one lease, one objective at a time.
 *
 * Stage 0 built leases and epochs and only ever ran one worker, so nothing had
 * tested what happens when several hold leases at once. A lease is per worker,
 * not per process (`03-RUNTIME` §4), and this is the unit that makes that true:
 * a daemon runs several of these, each with its own lease, its own epoch, and
 * its own port bound to that epoch.
 *
 * Nothing here is shared between slots except the control plane URL. If two
 * workers can interfere with each other, it will be through the log, which is
 * the only durable state there is, and that is exactly where it should show up.
 */

import type { ControlPlane } from "@maschina/worker";
import { httpControlPlane, WorkerFenced } from "@maschina/worker";

export interface SlotOptions {
	readonly controlPlaneUrl: string;
	readonly node: string;
	readonly worker: string;
	readonly leaseTtlMs: number;
	readonly renewEveryMs: number;
	readonly run: (objective: string, plane: ControlPlane) => Promise<void>;
	readonly say: (line: string) => void;
}

export class WorkerSlot {
	private plane: ControlPlane;
	private renewTimer: NodeJS.Timeout | null = null;
	private lost = false;
	epoch = 0n;
	/** What it is working on, so a supervisor can see without asking the log. */
	busyWith: string | null = null;

	constructor(private readonly options: SlotOptions) {
		this.plane = httpControlPlane(options.controlPlaneUrl);
	}

	get worker(): string {
		return this.options.worker;
	}

	get fenced(): boolean {
		return this.lost;
	}

	async start(): Promise<void> {
		const response = await fetch(`${this.options.controlPlaneUrl}/leases`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				worker: this.options.worker,
				node: this.options.node,
				ttlMs: this.options.leaseTtlMs,
			}),
		});
		if (!response.ok) throw new Error(`${this.options.worker}: no lease (${response.status})`);

		const lease = (await response.json()) as { epoch: string };
		this.epoch = BigInt(lease.epoch);
		// A port is a lease generation. Each slot gets its own, so one worker's
		// writes can never carry another's epoch.
		this.plane = httpControlPlane(this.options.controlPlaneUrl, this.epoch);
		this.options.say(`${this.options.worker} holds a lease at epoch ${this.epoch}`);

		this.renewTimer = setInterval(() => {
			void this.renew();
		}, this.options.renewEveryMs);
	}

	private async renew(): Promise<void> {
		try {
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
				// Somebody else holds it. Nothing to retry, and importantly this
				// stops only this slot: the others are different workers with
				// different leases and are not affected.
				this.lost = true;
				this.options.say(`${this.options.worker} was fenced`);
			}
		} catch {
			// A renewal that could not be sent is not a lost lease. The TTL will
			// decide, and guessing here would stop a worker for a blip.
		}
	}

	/** Take one objective if there is one going. Returns whether it did anything. */
	async tick(): Promise<boolean> {
		if (this.lost) return false;

		const found = await this.findWork();
		if (found === null) return false;

		if (!(await this.claim(found))) return false;

		this.busyWith = found;
		try {
			await this.options.run(found, this.plane);
			this.options.say(`${this.options.worker} finished ${found}`);
		} catch (error: unknown) {
			if (error instanceof WorkerFenced) {
				this.lost = true;
				this.options.say(`${this.options.worker} was fenced mid-objective`);
			} else {
				// One worker's objective failing says nothing about the others.
				this.options.say(
					`${this.options.worker} did not finish ${found}: ${
						error instanceof Error ? error.message : String(error)
					}`,
				);
			}
		} finally {
			this.busyWith = null;
		}
		return true;
	}

	private async findWork(): Promise<string | null> {
		const response = await fetch(`${this.options.controlPlaneUrl}/objectives?state=admitted`);
		if (!response.ok) return null;
		const objectives = (await response.json()) as { id: string }[];
		return objectives[0]?.id ?? null;
	}

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
		if (response.ok) return true;

		// Losing a race is ordinary; being fenced is not. A fenced slot has no
		// business asking for more work, and would otherwise keep asking until
		// its renewal happened to notice.
		if (response.status === 409) {
			const body = (await response.json().catch(() => ({}))) as { fenced?: boolean };
			if (body.fenced === true) {
				this.lost = true;
				this.options.say(`${this.options.worker} was fenced while looking for work`);
			}
		}
		return false;
	}

	async stop(reason: string): Promise<void> {
		if (this.renewTimer !== null) {
			clearInterval(this.renewTimer);
			this.renewTimer = null;
		}
		if (this.lost) return;
		await fetch(
			`${this.options.controlPlaneUrl}/leases/${encodeURIComponent(this.options.worker)}/release`,
			{
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ reason }),
			},
		).catch(() => undefined);
	}
}
