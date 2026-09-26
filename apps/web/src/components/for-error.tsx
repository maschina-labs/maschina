/**
 * Which page to show for which failure.
 *
 * One place, so every screen answers the same failure the same way. The status is what decides: a
 * message alone cannot tell "sign in" from "not yours" from "the API is down", because all three can
 * produce the same sentence.
 */

import { ApiError } from "../lib/machines.ts";
import { NotYours, Offline, SignedOut } from "./states.tsx";
import { Failed } from "./ui.tsx";

export function ForError({
	error,
	title,
	retry,
	connect,
}: {
	error: Error;
	title?: string;
	retry?: () => void;
	connect?: () => void;
}) {
	const status = error instanceof ApiError ? error.status : undefined;

	if (status === 401) return <SignedOut {...(connect ? { connect } : {})} />;
	if (status === 403) return <NotYours />;
	// No status at all means the request never reached anything that could answer it.
	if (status === undefined || status === 503) {
		return <Offline {...(retry ? { retry } : {})} />;
	}

	return (
		<Failed {...(title ? { title } : {})} detail={error.message} {...(retry ? { retry } : {})} />
	);
}
