/** Connection settings, decided in one place so every service connects the same way. */

import { MaschinaError } from "@maschina/core";

export type ConnectionConfig = {
	url: string;
	/** Shown in pg_stat_activity, so a slow query can be traced to its service. */
	applicationName: string;
	maxConnections?: number;
};

export type ConnectionOptions = {
	max: number;
	ssl: "require" | false;
	connection: { application_name: string };
	idle_timeout: number;
	connect_timeout: number;
	prepare: boolean;
};

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]", "postgres"]);

export function connectionOptions(config: ConnectionConfig): ConnectionOptions {
	let host: string;
	try {
		host = new URL(config.url).hostname;
	} catch {
		throw new MaschinaError("invalid_input", "the database URL is not a valid URL");
	}
	const max = config.maxConnections ?? 10;
	if (!Number.isInteger(max) || max < 1) {
		throw new MaschinaError("invalid_input", "maxConnections must be a positive integer");
	}
	return {
		max,
		// Anything that isn't this machine or the local Docker network is reached over TLS.
		ssl: LOCAL_HOSTS.has(host) ? false : "require",
		connection: { application_name: config.applicationName },
		idle_timeout: 20,
		connect_timeout: 10,
		// Transaction-mode connection poolers can't hold prepared statements.
		prepare: false,
	};
}
