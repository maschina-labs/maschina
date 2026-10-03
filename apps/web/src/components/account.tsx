import { User } from "@phosphor-icons/react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useSession, useSignIn } from "../lib/session.ts";
import { toast } from "../lib/toasts.ts";
import { toggleEdge } from "./edges.tsx";

/**
 * The corner: the wallet you signed in with, at a glance, and a tile that opens your account in its own
 * panel on the right. Signed out, it connects instead. Nothing else goes here: the top is the greeting
 * and who you are, not another row of buttons.
 */

const short = (address: string) => `${address.slice(0, 4)}…${address.slice(-4)}`;

const TILE =
	"grid size-11 place-items-center bg-white/[0.11] text-neutral-100 transition-colors duration-300 hover:bg-white/[0.18] md:size-12";

export function Account() {
	const { api } = useRouter().options.context;
	const queryClient = useQueryClient();
	const session = useSession(api);
	const signIn = useSignIn(api, queryClient);

	if (session.data) {
		return (
			<div className="hidden items-center gap-4 md:flex">
				<span className="font-display text-[20px] text-neutral-100">
					{short(session.data.walletAddress)}
				</span>
				<button
					type="button"
					aria-label="Your account"
					onClick={() => toggleEdge("account")}
					className={TILE}
				>
					<User size={24} weight="light" />
				</button>
			</div>
		);
	}
	return (
		<div className="hidden items-center gap-4 md:flex">
			<button
				type="button"
				disabled={session.isPending || signIn.isPending}
				onClick={() =>
					signIn.mutate(undefined, {
						// Closing the wallet picker is a choice, not a problem worth a message.
						onError: (error) =>
							error.name === "NoWalletChosen" ? undefined : toast(error.message, "problem"),
					})
				}
				className="flex items-center gap-4 disabled:opacity-50"
			>
				<span className="font-display text-[18px] text-neutral-100 md:text-[20px]">
					{signIn.isPending ? "Check your wallet" : "Connect"}
				</span>
				<span className={TILE}>
					<User size={24} weight="light" />
				</span>
			</button>
		</div>
	);
}
