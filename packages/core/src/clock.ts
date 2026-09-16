/**
 * Time as a dependency. Schedules, leases and expiry all ask a clock rather than reading the system
 * time directly, so tests can move time forward without waiting for it.
 */

export interface Clock {
	now(): Date;
}

export const systemClock: Clock = {
	now: () => new Date(),
};

/** A clock that only moves when told to. For tests. */
export class ManualClock implements Clock {
	#current: number;

	constructor(start: Date | string = "2026-01-01T00:00:00.000Z") {
		this.#current = new Date(start).getTime();
	}

	now(): Date {
		return new Date(this.#current);
	}

	advance(milliseconds: number): void {
		if (milliseconds < 0) throw new RangeError("a clock cannot move backwards");
		this.#current += milliseconds;
	}

	set(to: Date | string): void {
		const next = new Date(to).getTime();
		if (next < this.#current) throw new RangeError("a clock cannot move backwards");
		this.#current = next;
	}
}
