/** A readable message for whatever was thrown, which is not always an Error. */
export const failureMessage = (error: unknown): string =>
	error instanceof Error ? error.message : "Unexpected error";
