/**
 * One answer, shared by everybody asking at once.
 *
 * The public record is open to anyone, with no sign-in and no rate limit worth the name, and it reads
 * the same rows every time. Without this, a page on a screen somewhere, a crawler, or one person
 * holding refresh turns into one database query each, against the same database the signer uses to
 * decide whether a trade may happen. That is the part that matters: the public page must never be a
 * way to make the money path slow.
 *
 * A `cache-control` header is not enough on its own. It asks politely, and anything can ask again
 * with a query string on the end.
 *
 * Two things it deliberately does:
 *
 * - **Shares the work in flight.** Ten requests arriving together make one query, not ten, because
 *   the promise is cached rather than the result. A cache that only stores finished answers still
 *   lets a crowd through the moment it expires.
 * - **Forgets a failure immediately.** A failed read is not cached, so a blip is retried on the next
 *   request rather than being served for the rest of the window.
 */
export function cached<T>(work: () => Promise<T>, forMs: number): { read(): Promise<T> } {
	let answer: { at: number; value: Promise<T> } | undefined;

	return {
		read(now = Date.now()) {
			if (answer && now - answer.at < forMs) return answer.value;

			const value = work();
			answer = { at: now, value };
			// A failure must not be served for the rest of the window, so it is dropped as soon as it
			// is known. Anything already waiting on it still gets the rejection.
			value.catch(() => {
				if (answer?.value === value) answer = undefined;
			});
			return value;
		},
	};
}
