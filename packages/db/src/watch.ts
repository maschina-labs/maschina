/**
 * Being told when something is recorded, instead of asking.
 *
 * Every surface that shows the log was polling for it. Polling is a question
 * asked repeatedly by something with no way of knowing the answer changed, and
 * the database is the one thing that always knows. The `events_announced`
 * trigger says so, and this listens.
 *
 * **This is not a queue and must never become one.** `CLAUDE.md` forbids adding
 * one, and this is the shape that would quietly turn into one. Nothing is stored,
 * nothing is retried, and a listener that was disconnected missed it. That is
 * fine: the notification carries an id, not an event, and anything that must not
 * miss something reads the log. The log is the durable thing. This is only a way
 * of learning that reading it would now be worthwhile.
 */

import { Client } from "pg";

const CHANNEL = "maschina_events";

/** How long to wait before reconnecting after the connection drops. */
const RETRY_MS = 1_000;

export interface Watching {
	/** Stop listening and close the connection. */
	readonly stop: () => Promise<void>;
}

/**
 * Call `onEvent` with the id of every event recorded from now on.
 *
 * Needs its own connection, not a pooled one: a client that is listening cannot
 * be handed to somebody else to run a query on, and a pool exists precisely to
 * hand clients around.
 */
export async function watchEvents(
	url: string,
	onEvent: (id: string) => void,
	onTrouble?: (problem: string) => void,
): Promise<Watching> {
	let client: Client | null = null;
	let stopped = false;
	let retry: NodeJS.Timeout | null = null;

	const connect = async (): Promise<void> => {
		if (stopped) return;
		try {
			client = new Client({ connectionString: url });
			// A dropped connection is normal, not exceptional: the database
			// restarts, the network blips. Say so and come back rather than
			// throwing out of a callback nobody is waiting on.
			client.on("error", (error: Error) => {
				onTrouble?.(error.message);
				void reconnect();
			});
			client.on("notification", (message) => {
				if (message.channel === CHANNEL && message.payload !== undefined) {
					onEvent(message.payload);
				}
			});
			await client.connect();
			await client.query(`LISTEN ${CHANNEL}`);
		} catch (error: unknown) {
			onTrouble?.(error instanceof Error ? error.message : String(error));
			void reconnect();
		}
	};

	const reconnect = async (): Promise<void> => {
		if (stopped || retry !== null) return;
		const dying = client;
		client = null;
		try {
			await dying?.end();
		} catch {
			// Already gone. Nothing to do about it and nothing worth saying.
		}
		retry = setTimeout(() => {
			retry = null;
			void connect();
		}, RETRY_MS);
	};

	await connect();

	return {
		stop: async () => {
			stopped = true;
			if (retry !== null) clearTimeout(retry);
			try {
				await client?.end();
			} catch {
				// Closing something already closed is not a failure.
			}
			client = null;
		},
	};
}
