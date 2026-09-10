/**
 * Environment slice 1 proof. The window reads the log.
 *
 * `ENVIRONMENT_PLAN` slice 1:
 *
 *   "Append an event with the CLI and watch it appear in the window without a
 *    restart. Stop the control plane and confirm the window says what happened
 *    rather than going blank. Confirm the renderer has no network access of its
 *    own."
 *
 * The window itself is not driven here. What is proved is the read path the
 * window uses and the boundaries around it, because those are the parts that can
 * be wrong silently. A rendered table is checked by looking at it.
 *
 * It lives here rather than in `apps/desktop` on purpose. That package cannot
 * depend on the database or on a server, and `check-node-boundary.mjs` fails the
 * build if it ever does. So the proof runs where those exist and reads the
 * desktop's source across the boundary rather than pulling it across.
 *
 * Run: pnpm proof
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { serve } from "@hono/node-server";
import { append, appPool, PAYLOAD_V } from "@maschina/db";
import { check, resetLog, verdict } from "../../../packages/db/test/harness.ts";
import { createApp } from "../src/app.ts";

const PORT = 8794;
const desktop = new URL("../../../apps/desktop/src/", import.meta.url).pathname;

async function main(): Promise<void> {
	await resetLog();
	const pool = appPool();
	const server = serve({ fetch: createApp(pool).fetch, port: PORT, hostname: "127.0.0.1" });

	// The client reads its base from the environment, so point it at this one.
	process.env.MASCHINA_CONTROL_PLANE_URL = `http://127.0.0.1:${PORT}`;
	const plane = await import("../../../apps/desktop/src/main/control-plane.ts");

	console.log("\nEnvironment slice 1: the window reads the log\n");

	try {
		// 1. It reads what is actually there.
		console.log("1. What the log holds is what the window is given");
		const empty = await plane.events();
		check("an empty log reads as empty, not as an error", empty.ok && empty.value.length === 0);

		await append(pool, {
			actor: "human:ash",
			objective: null,
			epoch: 0n,
			type: "objective.stated",
			payload: { v: PAYLOAD_V, statement: "something to look at" },
		});
		const one = await plane.events();
		check("an appended event is readable", one.ok && one.value.length === 1);
		check(
			"with its type intact",
			one.ok && one.value[0]?.type === "objective.stated",
			one.ok ? (one.value[0]?.type ?? "") : "",
		);
		check(
			"and its payload, not a summary of it",
			one.ok && one.value[0]?.payload.statement === "something to look at",
		);
		check(
			"ids arrive as strings, because they do not survive JSON as numbers",
			one.ok && typeof one.value[0]?.id === "string",
			one.ok ? typeof one.value[0]?.id : "",
		);

		// 2. Filtering matches the CLI, because both go through the same surface.
		console.log("\n2. The same question asked here and from the CLI has one answer");
		await append(pool, {
			actor: "worker:a",
			objective: null,
			epoch: 0n,
			type: "worker.did_something",
			payload: { v: PAYLOAD_V },
		});
		const mine = await plane.events({ actor: "worker:a" });
		check("filtering by actor works", mine.ok && mine.value.length === 1);
		check("and returns the right one", mine.ok && mine.value[0]?.actor === "worker:a");
		const limited = await plane.events({ limit: 1 });
		check("a limit is respected", limited.ok && limited.value.length === 1);

		// 3. Losing the control plane is reported, never swallowed.
		console.log("\n3. Losing the control plane says so");
		await new Promise<void>((resolve) => server.close(() => resolve()));
		const gone = await plane.events();
		check("it does not pretend the log is empty", !gone.ok);
		check(
			"it says where it looked and what to do",
			!gone.ok && gone.problem.includes(String(PORT)) && gone.problem.includes("pnpm dev"),
			!gone.ok ? gone.problem : "",
		);
		check(
			"and it is not an exception the caller has to catch",
			typeof gone === "object" && "ok" in gone,
		);
	} finally {
		await pool.end();
	}

	// 4. The boundaries, read from the source rather than assumed.
	console.log("\n4. The window cannot reach past the control plane");
	// Comments stripped first. The first version of this section asserted against
	// whole files and failed on three checks, every one of them matching the
	// documentation rather than the code: the preload's comment saying there is no
	// `invoke(channel, ...)` passthrough, and two comments naming the database
	// package they promise never to import. A check that reads prose proves
	// nothing about behaviour.
	const code = (file: string) =>
		readFileSync(join(desktop, file), "utf8")
			.replace(/\/\*[\s\S]*?\*\//g, "")
			.replace(/^\s*\/\/.*$/gm, "");

	const main = code("main/index.ts");
	const preload = code("preload/index.ts");
	const client = code("main/control-plane.ts");
	const app = code("renderer/App.tsx");

	check("context isolation is on", main.includes("contextIsolation: true"));
	check("node integration is off", main.includes("nodeIntegration: false"));
	check("the renderer is sandboxed", main.includes("sandbox: true"));
	check(
		"the renderer never calls fetch itself",
		!app.includes("fetch("),
		"it asks the main process, which asks the control plane",
	);
	check(
		"the bridge exposes named operations, not a channel",
		!preload.includes("invoke: (") && !/invoke\(\s*channel/.test(preload),
	);
	check(
		"there is no write path to the log from this surface",
		!client.includes('method: "POST"') && !/append/i.test(client),
		"a viewer that can write to the log is not a viewer",
	);
	check(
		"and the app imports no database package",
		!main.includes("@maschina/db") && !client.includes("@maschina/db"),
	);

	verdict("Environment slice 1 proof");
}

main().catch((error: unknown) => {
	console.error(error);
	process.exitCode = 1;
});
