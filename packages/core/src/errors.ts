/**
 * Every error Maschina raises on purpose carries a stable code. Callers branch on the code, never on
 * the message, and the gateway maps codes to HTTP statuses in one place.
 */

export const ERROR_CODES = {
	invalid_input: 400,
	invalid_amount: 400,
	unauthenticated: 401,
	forbidden: 403,
	not_found: 404,
	conflict: 409,
	insufficient_amount: 409,
	limit_exceeded: 429,
	unavailable: 503,
	internal: 500,
} as const;

export type ErrorCode = keyof typeof ERROR_CODES;

export class MaschinaError extends Error {
	override readonly name = "MaschinaError";
	readonly code: ErrorCode;
	readonly details: Readonly<Record<string, unknown>> | undefined;

	constructor(
		code: ErrorCode,
		message: string,
		options: { details?: Record<string, unknown>; cause?: unknown } = {},
	) {
		super(message, options.cause === undefined ? undefined : { cause: options.cause });
		this.code = code;
		this.details = options.details;
	}

	get status(): number {
		return ERROR_CODES[this.code];
	}
}

export function isMaschinaError(value: unknown): value is MaschinaError {
	return value instanceof MaschinaError;
}
