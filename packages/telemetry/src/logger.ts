/**
 * Structured JSON logs, one line per event, with secrets removed before anything is written.
 * Every service logs through this, so a key or token can't leak through one that forgot.
 */

import pino, { type DestinationStream, type Logger, type LoggerOptions } from "pino";

export type { Logger } from "pino";

/** Anything under one of these names is replaced before it is written. */
export const REDACTED_KEYS = [
	"password",
	"secret",
	"token",
	"apiKey",
	"api_key",
	"privateKey",
	"private_key",
	"seed",
	"mnemonic",
	"authorization",
	"cookie",
	"set-cookie",
];

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

/** Top level, one level down and two levels down, with bracket syntax for names like set-cookie. */
const redactPaths = REDACTED_KEYS.flatMap((key) => {
	const segment = IDENTIFIER.test(key) ? `.${key}` : `["${key}"]`;
	const top = IDENTIFIER.test(key) ? key : segment;
	return [top, `*${segment}`, `*.*${segment}`];
});

export type LoggerConfig = {
	service: string;
	level?: LoggerOptions["level"];
	/** Human-readable output for local development. */
	pretty?: boolean;
};

export function createLogger(config: LoggerConfig, destination?: DestinationStream): Logger {
	const options: LoggerOptions = {
		level: config.level ?? "info",
		base: { service: config.service },
		timestamp: pino.stdTimeFunctions.isoTime,
		redact: { paths: redactPaths, censor: "[redacted]" },
		formatters: {
			level: (label) => ({ level: label }),
		},
	};

	if (destination) return pino(options, destination);
	if (config.pretty) {
		return pino({ ...options, transport: { target: "pino-pretty", options: { colorize: true } } });
	}
	return pino(options);
}
