/**
 * Error reporting. Off unless a DSN is configured, and the SDK is only loaded when it is, so a
 * service without error reporting never pays for it at startup.
 */

export type ErrorReportingConfig = {
	dsn: string | undefined;
	service: string;
	environment: string;
	release?: string;
};

export type ErrorReporter = {
	enabled: boolean;
	capture: (error: unknown, context?: Record<string, unknown>) => void;
	flush: (timeoutMs?: number) => Promise<void>;
};

const disabled: ErrorReporter = {
	enabled: false,
	capture: () => {},
	flush: async () => {},
};

export async function initErrorReporting(config: ErrorReportingConfig): Promise<ErrorReporter> {
	if (!config.dsn) return disabled;

	const Sentry = await import("@sentry/node");
	Sentry.init({
		dsn: config.dsn,
		environment: config.environment,
		release: config.release,
		initialScope: { tags: { service: config.service } },
		sendDefaultPii: false,
		tracesSampleRate: 0,
	});

	return {
		enabled: true,
		capture: (error, context) => {
			Sentry.captureException(error, context ? { extra: context } : undefined);
		},
		flush: async (timeoutMs = 2_000) => {
			await Sentry.flush(timeoutMs);
		},
	};
}
