/**
 * Is a target inside a capability's scope?
 *
 * This is the whole filesystem authority check, and it is the function most
 * worth attacking. `05-CAPABILITIES` §7: a shell is bounded by its isolation
 * boundary rather than by command filtering, and a filesystem capability is
 * bounded by exactly this comparison.
 *
 * Pure and synchronous on purpose, so it is unit testable without a disk.
 */

import { isAbsolute, resolve, sep } from "node:path";

import type { ResourceKind } from "./capability.ts";

/**
 * True when `target` is inside `scope`.
 *
 * Three ways this gets written wrong, all of them handled here:
 *
 * **Raw string prefix.** `"/sandbox-evil".startsWith("/sandbox")` is true, and
 * `/sandbox-evil` is not inside `/sandbox`. The comparison has to land on a path
 * separator, not on any character.
 *
 * **Unresolved traversal.** `/sandbox/../etc/passwd` starts with `/sandbox` as a
 * string and is `/etc/passwd` as a path. Both sides are resolved first.
 *
 * **Relative paths.** A relative target resolves against the process working
 * directory, which is not the scope, so what it means depends on where the
 * process happens to be. Refused outright rather than resolved into something
 * plausible.
 *
 * **The limit worth stating: this does not follow symlinks.** A symlink inside
 * the scope pointing out of it resolves, at the filesystem layer, to somewhere
 * this check would have refused. Closing that needs `realpath`, which is I/O and
 * would make this async and untestable without a disk. The real containment for
 * that case is the isolation boundary (`06-NODES` §5), which is what bounds a
 * shell too. Recorded rather than papered over.
 */
export function withinScope(scope: string, target: string): boolean {
	if (!isAbsolute(scope) || !isAbsolute(target)) return false;

	const root = resolve(scope);
	const path = resolve(target);

	if (path === root) return true;
	return path.startsWith(root.endsWith(sep) ? root : root + sep);
}

/** Why a target is outside a scope, for a denial record that explains itself. */
export function scopeViolation(scope: string, target: string): string {
	if (!isAbsolute(scope)) return `scope ${scope} is not an absolute path`;
	if (!isAbsolute(target)) {
		return `target ${target} is not an absolute path, so what it means depends on the working directory`;
	}
	return `${resolve(target)} is outside ${resolve(scope)}`;
}

/**
 * Containment, for whichever kind of resource the capability is over.
 *
 * A filesystem scope is a path prefix and containment is the comparison above.
 * A model scope is a `ModelClass` and containment is **equality**.
 *
 * Equality, and deliberately not a hierarchy. It is tempting to say a capability
 * for `reasoning` obviously covers `fast`, since fast is the cheaper and weaker
 * thing. That is a widening path: it hands a holder authority nobody granted,
 * derived from an ordering invented in code rather than written in the grant.
 * `04-WORKERS` §5 says delegation attenuates only, and an implicit ordering is
 * the same mistake one level down. A worker that needs two classes holds two
 * capabilities, and the log says so.
 */
export function withinScopeOf(resource: ResourceKind, scope: string, target: string): boolean {
	switch (resource) {
		case "filesystem":
			return withinScope(scope, target);
		case "model":
			return scope === target;
	}
}

/**
 * Why a target was outside scope, in words a human can act on.
 *
 * Split by resource for the same reason the check is: a model refusal explained
 * in the language of absolute paths reads as a wiring bug rather than as the
 * denial it is, and a denial nobody understands is a denial nobody acts on.
 */
export function scopeViolationOf(
	resource: ResourceKind,
	scope: string,
	target: string,
): string {
	switch (resource) {
		case "filesystem":
			return scopeViolation(scope, target);
		case "model":
			return `this capability is for the ${scope} model class, not ${target}`;
	}
}
