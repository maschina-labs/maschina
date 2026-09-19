/** What anyone sees when a page breaks. Kept out of the route file so it can be tested on its own. */

/** A readable message for whatever was thrown, which is not always an Error. */
export const failureMessage = (error: unknown): string =>
	error instanceof Error ? error.message : "Unexpected error";

export function Failure({ message }: { message: string }) {
	return (
		<div role="alert" className="rounded-lg border border-destructive/40 p-4">
			<p className="font-medium">Something went wrong.</p>
			<p className="text-muted-foreground text-sm">{message}</p>
		</div>
	);
}
