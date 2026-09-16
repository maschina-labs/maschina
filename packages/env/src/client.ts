/**
 * Browser configuration. Everything here ends up in a public bundle, so only variables prefixed
 * `VITE_` may be read, and a secret-looking name is refused outright.
 */

import { MaschinaError } from "@maschina/core";
import type { z } from "zod";
import { type EnvSource, loadEnv } from "./index.ts";

const SECRET_LOOKING = /(SECRET|PRIVATE|PASSWORD|TOKEN(?!_ADDRESS))/;

export function loadClientEnv<Shape extends z.ZodRawShape>(
	shape: Shape,
	source: EnvSource,
): z.infer<z.ZodObject<Shape>> {
	for (const key of Object.keys(shape)) {
		if (!key.startsWith("VITE_")) {
			throw new MaschinaError(
				"invalid_input",
				`${key} is not public. Browser variables start with VITE_`,
			);
		}
		if (SECRET_LOOKING.test(key)) {
			throw new MaschinaError(
				"invalid_input",
				`${key} looks like a secret and cannot ship to a browser`,
			);
		}
	}
	return loadEnv(shape, source);
}
