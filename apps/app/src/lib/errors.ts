import * as Sentry from "@sentry/react";

export function startErrorReporting(dsn: string | undefined): void {
	if (!dsn) return;
	Sentry.init({ dsn, sendDefaultPii: false, tracesSampleRate: 0 });
}
