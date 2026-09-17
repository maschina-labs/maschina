/**
 * The approved recipient checks (#25), shared by both providers.
 *
 * Unlike the other checks these depend on each other: the list changes between them. The recipient is
 * approved, paid, and removed again, and the removal always happens, so a failed run never leaves an
 * extra recipient on the wallet.
 */

import { CHECKS, type Check } from "./checklist.ts";
import { type CheckResult, type Outcome, runChecks } from "./run.ts";

const IDS = ["pay-approved-recipient", "pay-unapproved-recipient", "pay-removed-recipient"];

export const RECIPIENT_CHECKS: readonly Check[] = IDS.map((id) => {
	const check = CHECKS.find((c) => c.id === id);
	if (!check) throw new Error(`${id} is missing from the checklist`);
	return check;
});

export type RecipientSteps = {
	/** Replaces the wallet's extra approved recipients with this list, in place. */
	setRecipients(recipients: string[]): Promise<void>;
	/** Pays the address, as the check expects: allowed ones land, refused ones are never sent. */
	pay(check: Check, to: string): Promise<Outcome>;
};

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

export async function runRecipientChecks(options: {
	recipient: string;
	stranger: string;
	steps: RecipientSteps;
}): Promise<CheckResult[]> {
	const { recipient, stranger, steps } = options;
	const [approved, unapproved, removed] = RECIPIENT_CHECKS as [Check, Check, Check];
	const skipped = (why: string) => async (): Promise<Outcome> => ({
		status: "error",
		message: why,
	});

	// runChecks turns a failed payment into an error result, so only changing the list can throw here.
	let approveError: unknown;
	let removeError: unknown;
	let before: CheckResult[] = [];
	try {
		await steps.setRecipients([recipient]);
		before = await runChecks([approved, unapproved], (check) =>
			steps.pay(check, check === approved ? recipient : stranger),
		);
	} catch (error) {
		approveError = error;
	} finally {
		try {
			await steps.setRecipients([]);
		} catch (error) {
			removeError = error;
		}
	}

	if (approveError !== undefined) {
		const why = skipped(`the recipient couldn't be approved: ${message(approveError)}`);
		return runChecks([approved, unapproved, removed], why);
	}
	const after = await runChecks(
		[removed],
		removeError === undefined
			? (check) => steps.pay(check, recipient)
			: skipped(`the recipient couldn't be removed: ${message(removeError)}`),
	);
	return [...before, ...after];
}
