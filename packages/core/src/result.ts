/** A value or an error, for code where failure is expected and must be handled, not thrown. */

export type Ok<T> = { readonly ok: true; readonly value: T };
export type Err<E> = { readonly ok: false; readonly error: E };
export type Result<T, E> = Ok<T> | Err<E>;

export const ok = <T>(value: T): Ok<T> => ({ ok: true, value });
export const err = <E>(error: E): Err<E> => ({ ok: false, error });

/** Returns the value, or throws the error. For call sites where failure really is exceptional. */
export function unwrap<T, E>(result: Result<T, E>): T {
	if (result.ok) return result.value;
	throw result.error instanceof Error ? result.error : new Error(String(result.error));
}
