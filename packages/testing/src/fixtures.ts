/** Small builders that keep tests readable and consistent. */

import { type BaseUnits, baseUnitsOf, type Id, ManualClock, newId } from "@maschina/core";

export const units = (value: bigint | number): BaseUnits => baseUnitsOf(BigInt(value));

export const testClock = (start = "2026-09-16T12:00:00.000Z"): ManualClock =>
	new ManualClock(start);

export const testId = <Kind extends string>(): Id<Kind> => newId<Kind>();
