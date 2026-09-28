import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { useMachines } from "../lib/machines.ts";
import { type SignedInOwner, useSession, useSignIn, useSignOut } from "../lib/session.ts";
import { WalletPanelView } from "./wallet-panel.tsx";

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
	onOpen,
}: {
	/** Undefined while the session is still being asked for, null when nobody is signed in. */
	owner: SignedInOwner | null | undefined;
	signingIn: boolean;
	onSignIn: () => void;
	/** Opens the wallet panel, once signed in. */
	onOpen: () => void;
}) {
	if (owner) {
		return (
			<button type="button" onClick={onOpen} className={BUTTON}>
				Wallet
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

/** Connect when signed out; once signed in, the wallet panel. */
export function WalletButton() {
	const { api } = useRouter().options.context;
	const queryClient = useQueryClient();
	const session = useSession(api);
	const signIn = useSignIn(api, queryClient);
	const signOut = useSignOut(api, queryClient);
	const machines = useMachines(api);
	const [open, setOpen] = useState(false);
	const owner = session.isPending ? undefined : (session.data ?? null);
	return (
		<>
			<WalletButtonView
				owner={owner}
				signingIn={signIn.isPending}
				onSignIn={() => signIn.mutate()}
				onOpen={() => setOpen((was) => !was)}
			/>
			{open && owner ? (
				<WalletPanelView
					owner={owner}
					machines={machines.data ?? []}
					onClose={() => setOpen(false)}
					onDisconnect={() => {
						setOpen(false);
						signOut.mutate();
					}}
				/>
			) : null}
		</>
	);
}
