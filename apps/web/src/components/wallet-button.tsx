import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { type SignedInOwner, useSession, useSignIn, useSignOut } from "../lib/session.ts";

/**
 * The header's own language: the nav's small caps, in a chip of the same glass one step brighter, with no
 * border. It reads as part of the bar rather than something stuck on it.
 */
const BUTTON =
	"inline-flex h-7 items-center bg-[oklch(1_0_0/0.08)] px-3.5 text-[10.5px] text-neutral-200 uppercase tracking-[0.14em] transition-colors hover:bg-[oklch(1_0_0/0.14)] hover:text-neutral-50 disabled:opacity-50";

export function WalletButtonView({
	owner,
	signingIn,
	onSignIn,
	onSignOut,
}: {
	/** Undefined while the session is still being asked for, null when nobody is signed in. */
	owner: SignedInOwner | null | undefined;
	signingIn: boolean;
	onSignIn: () => void;
	onSignOut: () => void;
}) {
	if (owner) {
		return (
			<button type="button" onClick={onSignOut} className={BUTTON}>
				Disconnect
			</button>
		);
	}
	return (
		<button
			type="button"
			onClick={onSignIn}
			disabled={signingIn || owner === undefined}
			className={BUTTON}
		>
			{signingIn ? "Check your wallet" : "Connect"}
		</button>
	);
}

export function WalletButton() {
	const { api } = useRouter().options.context;
	const queryClient = useQueryClient();
	const session = useSession(api);
	const signIn = useSignIn(api, queryClient);
	const signOut = useSignOut(api, queryClient);
	return (
		<WalletButtonView
			owner={session.isPending ? undefined : (session.data ?? null)}
			signingIn={signIn.isPending}
			onSignIn={() => signIn.mutate()}
			onSignOut={() => signOut.mutate()}
		/>
	);
}
