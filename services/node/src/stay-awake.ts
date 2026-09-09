/**
 * Keeping the machine awake while work is in flight. Opt in.
 *
 * A node that is running an objective should not have the machine idle its way
 * to sleep underneath it. Every platform has a way to say so:
 *
 *   macOS    `caffeinate -i`          prevents idle sleep
 *   Linux    `systemd-inhibit`        takes an idle inhibitor
 *   Windows  `SetThreadExecutionState`  not wired up here yet
 *
 * **What this does not do, and cannot.** It prevents *idle* sleep. It does not
 * keep a laptop working with the lid closed: macOS sleeps on lid close whatever
 * assertions are held, unless the machine is on power with an external display.
 * Work that has to survive a closed lid has to run on a machine that stays open,
 * which is a second node, which is Stage 2.
 *
 * Saying otherwise would be selling a guarantee the operating system does not
 * offer, and the first time somebody shut a laptop expecting work to continue
 * they would find out we were wrong rather than that they were.
 *
 * **Opt in**, because holding a machine awake is a thing to be asked for rather
 * than assumed. `MASCHINA_STAY_AWAKE=1`.
 */

import { type ChildProcess, spawn } from "node:child_process";
import { platform } from "node:os";

export interface StayAwake {
	/** Hold the machine awake. Safe to call when already held. */
	hold(reason: string): void;
	/** Let it sleep normally again. Safe to call when not held. */
	release(): void;
	readonly held: boolean;
	/** What this platform can actually promise, in a sentence. */
	readonly capability: string;
}

function commandFor(reason: string): { command: string; args: string[] } | null {
	switch (platform()) {
		case "darwin":
			// -i prevents idle sleep. Deliberately not -d: a node has no business
			// keeping a screen on, and not -s, which only applies on mains power
			// and reads as a stronger promise than it is.
			return { command: "caffeinate", args: ["-i"] };
		case "linux":
			return {
				command: "systemd-inhibit",
				args: [
					"--what=idle",
					"--who=maschina",
					`--why=${reason}`,
					"--mode=block",
					"sleep",
					"infinity",
				],
			};
		default:
			return null;
	}
}

export function stayAwake(
	enabled: boolean,
	log: (line: string) => void = console.log,
): StayAwake {
	let child: ChildProcess | null = null;

	const capability =
		platform() === "darwin"
			? "prevents idle sleep, not sleep from closing the lid"
			: platform() === "linux"
				? "takes an idle inhibitor"
				: `no wake assertion is wired up for ${platform()}`;

	return {
		get held() {
			return child !== null;
		},
		capability,

		hold(reason: string): void {
			if (!enabled || child !== null) return;
			const spec = commandFor(reason);
			if (spec === null) {
				log(`staying awake is not supported here: ${capability}`);
				return;
			}
			try {
				child = spawn(spec.command, spec.args, { stdio: "ignore", detached: false });
				child.on("error", () => {
					// The tool is missing. Worth saying once and carrying on: a node
					// that refused to work because it could not prevent sleep would
					// be worse than one that might get slept.
					log(`could not hold the machine awake with ${spec.command}`);
					child = null;
				});
				child.on("exit", () => {
					child = null;
				});
				log(`holding the machine awake: ${capability}`);
			} catch {
				child = null;
			}
		},

		release(): void {
			if (child === null) return;
			child.kill();
			child = null;
			log("letting the machine sleep normally again");
		},
	};
}
