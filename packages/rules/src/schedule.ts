/**
 * When a machine is next due.
 *
 * "Every Monday at 9:00" means 9:00 where the owner lives, which is not a fixed moment in time: clocks
 * change twice a year in most places. Two things must never happen, because both cost real money:
 *
 *   - A run is skipped because its local time didn't exist that day (clocks jumped forward).
 *   - A run happens twice because its local time happened twice (clocks went back).
 *
 * So the rule is: **one occurrence per scheduled slot**, whatever the clocks do. When the wanted local
 * time doesn't exist, the run happens at the first moment that does. When it happens twice, the first
 * one counts and the second is ignored.
 *
 * This is a pure function of a schedule and a moment. It reads no clock, so tests can run it across
 * years and time zones without waiting.
 */

import { MaschinaError } from "@maschina/core";

export const WEEKDAYS = [
	"sunday",
	"monday",
	"tuesday",
	"wednesday",
	"thursday",
	"friday",
	"saturday",
] as const;

export type Weekday = (typeof WEEKDAYS)[number];

export type Schedule =
	| { every: "day"; hour: number; minute: number; timeZone: string }
	| { every: "week"; weekday: Weekday; hour: number; minute: number; timeZone: string }
	/** `dayOfMonth` past the end of a month runs on that month's last day, never in the next month. */
	| { every: "month"; dayOfMonth: number; hour: number; minute: number; timeZone: string };

type LocalTime = { year: number; month: number; day: number; hour: number; minute: number };

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

function assertSchedule(schedule: Schedule): void {
	const { hour, minute, timeZone } = schedule;
	if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
		throw new MaschinaError("invalid_input", "hour must be 0 to 23");
	}
	if (!Number.isInteger(minute) || minute < 0 || minute > 59) {
		throw new MaschinaError("invalid_input", "minute must be 0 to 59");
	}
	if (schedule.every === "month") {
		const { dayOfMonth } = schedule;
		if (!Number.isInteger(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 31) {
			throw new MaschinaError("invalid_input", "dayOfMonth must be 1 to 31");
		}
	}
	try {
		new Intl.DateTimeFormat("en-US", { timeZone });
	} catch {
		throw new MaschinaError("invalid_input", `unknown time zone: ${timeZone}`, {
			details: { timeZone },
		});
	}
}

const partsOf = (timeZone: string) =>
	new Intl.DateTimeFormat("en-US", {
		timeZone,
		hour12: false,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
	});

/** The local wall-clock time in a zone at a moment in time. */
function localTimeAt(timeZone: string, utcMs: number): LocalTime & { second: number } {
	const parts = Object.fromEntries(
		partsOf(timeZone)
			.formatToParts(new Date(utcMs))
			.filter((part) => part.type !== "literal")
			.map((part) => [part.type, Number(part.value)]),
	) as Record<string, number>;
	return {
		year: parts["year"] as number,
		month: parts["month"] as number,
		day: parts["day"] as number,
		// Some zones format midnight as hour 24.
		hour: (parts["hour"] as number) % 24,
		minute: parts["minute"] as number,
		second: parts["second"] as number,
	};
}

/** How far the zone is from UTC, in milliseconds, at that moment. */
function offsetAt(timeZone: string, utcMs: number): number {
	const local = localTimeAt(timeZone, utcMs);
	const asUtc = Date.UTC(
		local.year,
		local.month - 1,
		local.day,
		local.hour,
		local.minute,
		local.second,
	);
	return asUtc - Math.floor(utcMs / 1000) * 1000;
}

/**
 * The moment a local wall-clock time happens in a zone.
 *
 * When that local time doesn't exist (clocks jumped forward over it) this returns the first moment
 * after the jump, so the run still happens. When it happens twice (clocks went back) it returns the
 * first of the two.
 */
function utcFor(timeZone: string, local: LocalTime): number {
	const wanted = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute);
	let guess = wanted - offsetAt(timeZone, wanted);
	// Two passes settle any zone: the first uses the wrong offset, the second uses the right one.
	guess = wanted - offsetAt(timeZone, guess);
	const got = localTimeAt(timeZone, guess);
	const matches =
		got.year === local.year &&
		got.month === local.month &&
		got.day === local.day &&
		got.hour === local.hour &&
		got.minute === local.minute;
	if (matches) return guess;

	// The local time was skipped. Walk forward a minute at a time to the first moment past it, which is
	// where the clocks landed after the jump. Jumps are an hour or two, so this stops quickly.
	for (let minutes = 1; minutes <= 180; minutes++) {
		const candidate = guess + minutes * MINUTE;
		const at = localTimeAt(timeZone, candidate);
		const passed =
			at.year > local.year ||
			(at.year === local.year &&
				(at.month > local.month ||
					(at.month === local.month &&
						(at.day > local.day ||
							(at.day === local.day &&
								(at.hour > local.hour ||
									(at.hour === local.hour && at.minute >= local.minute)))))));
		if (passed) return candidate - at.second * 1000;
	}
	return guess;
}

const daysInMonth = (year: number, month: number) =>
	new Date(Date.UTC(year, month, 0)).getUTCDate();

type CalendarDay = { year: number; month: number; day: number };

/** The day after a calendar date, without touching clocks: a day with a clock change is still a day. */
function dayAfter({ year, month, day }: CalendarDay): CalendarDay {
	const next = new Date(Date.UTC(year, month - 1, day + 1));
	return { year: next.getUTCFullYear(), month: next.getUTCMonth() + 1, day: next.getUTCDate() };
}

/** The local date parts of the slot on a local calendar day, or nothing when that day isn't scheduled. */
function slotOn(schedule: Schedule, local: CalendarDay): LocalTime | undefined {
	const base = {
		year: local.year,
		month: local.month,
		hour: schedule.hour,
		minute: schedule.minute,
	};
	switch (schedule.every) {
		case "day":
			return { ...base, day: local.day };
		case "week": {
			const weekday = new Date(Date.UTC(local.year, local.month - 1, local.day)).getUTCDay();
			return WEEKDAYS[weekday] === schedule.weekday ? { ...base, day: local.day } : undefined;
		}
		case "month": {
			const last = daysInMonth(local.year, local.month);
			const day = Math.min(schedule.dayOfMonth, last);
			return local.day === day ? { ...base, day: local.day } : undefined;
		}
	}
}

/**
 * The first occurrence strictly after `afterMs`. Strictly, so asking again with the answer moves on
 * instead of returning the same slot forever.
 */
export function nextOccurrence(schedule: Schedule, afterMs: number): number {
	assertSchedule(schedule);
	const { timeZone } = schedule;
	// Start a day early: the slot on the local day of `after` may still be ahead, and a zone can be a
	// day behind UTC. Days are stepped as calendar dates, never by adding 24 hours, because a day with a
	// clock change is 23 or 25 hours long and adding 24 would step over it.
	let day: CalendarDay = localTimeAt(timeZone, afterMs - DAY);
	// A month schedule can wait 31 days, and a weekly one 7. Scanning 70 local days covers both.
	for (let scanned = 0; scanned <= 70; scanned++, day = dayAfter(day)) {
		const local = slotOn(schedule, day);
		if (!local) continue;
		const at = utcFor(timeZone, local);
		if (at > afterMs) return at;
	}
	throw new MaschinaError("internal", "no occurrence found in the next 70 days", {
		details: { schedule: JSON.stringify(schedule) },
	});
}

/** Every occurrence in a window, oldest first. Used to find runs that were missed while offline. */
export function occurrencesBetween(schedule: Schedule, fromMs: number, toMs: number): number[] {
	const found: number[] = [];
	let cursor = fromMs;
	while (found.length < 1000) {
		const next = nextOccurrence(schedule, cursor);
		if (next > toMs) break;
		found.push(next);
		cursor = next;
	}
	return found;
}
