/**
 * The HTTP foundation every service shares: request ids, security headers, body limits, timeouts,
 * errors and health checks behave identically everywhere.
 */

import type { ErrorBody } from "@maschina/contracts";
import { isMaschinaError, newId } from "@maschina/core";
import type { ErrorReporter, Logger } from "@maschina/telemetry";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { HTTPException } from "hono/http-exception";
import { requestId } from "hono/request-id";
import { secureHeaders } from "hono/secure-headers";
import { timeout } from "hono/timeout";
import type { ContentfulStatusCode } from "hono/utils/http-status";

export type ServiceVariables = {
	requestId: string;
	logger: Logger;
};

export type ServiceEnv = { Variables: ServiceVariables };

export type ServiceOptions = {
	service: string;
	logger: Logger;
	reporter?: ErrorReporter | undefined;
	/** Largest accepted request body, in bytes. */
	maxBodyBytes?: number;
	/** Requests taking longer than this are cut off. */
	timeoutMs?: number;
};

const SAFE_REQUEST_ID = /^[A-Za-z0-9-]{8,64}$/;

export function createServiceApp(options: ServiceOptions): Hono<ServiceEnv> {
	const { logger, reporter, maxBodyBytes = 1024 * 1024, timeoutMs = 30_000 } = options;
	const app = new Hono<ServiceEnv>();

	app.use(
		requestId({
			headerName: "x-request-id",
			// An incoming id is kept only if it's safe to log; anything else is replaced.
			generator: (c) => {
				const incoming = c.req.header("x-request-id");
				return incoming && SAFE_REQUEST_ID.test(incoming) ? incoming : newId();
			},
		}),
	);
	app.use(async (c, next) => {
		c.set("logger", logger.child({ requestId: c.get("requestId") }));
		const started = performance.now();
		await next();
		c.get("logger").info(
			{
				method: c.req.method,
				path: c.req.path,
				status: c.res.status,
				ms: Math.round(performance.now() - started),
			},
			"request",
		);
	});
	app.use(secureHeaders());
	app.use(
		bodyLimit({
			maxSize: maxBodyBytes,
			onError: () => {
				throw new HTTPException(413, { message: "request body is too large" });
			},
		}),
	);
	app.use(timeout(timeoutMs, () => new HTTPException(504, { message: "request timed out" })));

	app.notFound((c) => c.json(errorBody("not_found", "no such route", c.get("requestId")), 404));

	app.onError((error, c) => {
		const id = c.get("requestId") ?? "unknown";
		const log = c.get("logger") ?? logger;

		if (isMaschinaError(error)) {
			if (error.status >= 500) {
				log.error({ err: error }, "request failed");
				reporter?.capture(error, { requestId: id });
			}
			return c.json(errorBody(error.code, error.message, id), error.status as ContentfulStatusCode);
		}
		if (error instanceof HTTPException) {
			return c.json(errorBody(codeForStatus(error.status), error.message, id), error.status);
		}

		// Anything unexpected is logged in full and reported, and the caller learns nothing about it.
		log.error({ err: error }, "unhandled error");
		reporter?.capture(error, { requestId: id });
		return c.json(errorBody("internal", "something went wrong", id), 500);
	});

	return app;
}

function codeForStatus(status: number): string {
	if (status === 401) return "unauthenticated";
	if (status === 403) return "forbidden";
	if (status === 404) return "not_found";
	if (status === 429) return "limit_exceeded";
	if (status >= 500) return "unavailable";
	return "invalid_input";
}

function errorBody(code: string, message: string, requestId: string): ErrorBody {
	return { error: { code, message, requestId } };
}
