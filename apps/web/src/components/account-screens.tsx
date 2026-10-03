import { useQueryClient } from "@tanstack/react-query";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { describeEvent } from "../lib/describe.ts";
import { useSession, useSignIn } from "../lib/session.ts";
import { toast } from "../lib/toasts.ts";
import { Away, BUTTON, Headline, Note, Onward, Panel, Rows } from "./kit.tsx";
import { useSidePicture } from "./portfolio.tsx";

/**
 * Your wallet and getting in: the wallet screen and staking, signing in, the welcome, what to do with no
 * wallet, invites, feedback and the legal pages.
 */

const when = (at: string) =>
	new Date(at).toLocaleString([], {
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});

/** Connecting, from any screen: a wallet that is missing sends you to where to get one. */
function useConnect() {
	const { api } = useRouter().options.context;
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	const signIn = useSignIn(api, queryClient);
	return {
		pending: signIn.isPending,
		connect: () =>
			signIn.mutate(undefined, {
				onError: (error) =>
					error.name === "NoWallet"
						? void navigate({ to: "/get-a-wallet" })
						: toast(error.message, "problem"),
			}),
	};
}

export function WalletScreen() {
	const picture = useSidePicture();
	const home = picture
		.flatMap(({ machine, record }) =>
			record
				.filter((entry) => entry.type === "withdrawal.completed")
				.map((entry) => ({ entry, name: machine.name })),
		)
		.sort((a, b) => b.entry.occurredAt.localeCompare(a.entry.occurredAt));
	return (
		<>
			<Panel size="big" name="What came home" scroll>
				{home.length === 0 ? (
					<Note>Nothing has been withdrawn yet.</Note>
				) : (
					<ol className="flex flex-col">
						{home.map(({ entry, name }) => (
							<li
								key={entry.id}
								className="grid grid-cols-[auto_1fr] gap-x-5 border-white/[0.06] border-b py-2.5"
							>
								<time className="text-[13px] text-neutral-500 tabular-nums">
									{when(entry.occurredAt)}
								</time>
								<span className="truncate text-[15px] text-neutral-100">
									{name} · {describeEvent(entry).title.toLowerCase()}
								</span>
							</li>
						))}
					</ol>
				)}
			</Panel>
			<Panel size="large" name="Put it to work">
				<Onward to="/new">Make a machine</Onward>
				<Onward to="/swap">Swap</Onward>
				<Onward to="/wallet/stake">Stake idle SOL</Onward>
				<Note>What your own wallet holds, live, arrives with wallet balances.</Note>
			</Panel>
		</>
	);
}

export function StakeScreen() {
	return (
		<>
			<Panel size="big" name="How it works">
				<Headline>Idle SOL, earning</Headline>
				<Note>
					Swap idle SOL for a liquid staking token such as JitoSOL. It earns staking rewards and
					swaps back at any time. The yield parker machine will do this for you, automatically.
				</Note>
			</Panel>
			<Panel size="large" name="Rates">
				<Rows rows={[["JitoSOL", "-"]]} />
				<Note>Live rates, and staking from here, arrive with the yield parker.</Note>
			</Panel>
		</>
	);
}

export function SignInScreen() {
	const { api } = useRouter().options.context;
	const session = useSession(api);
	const { connect, pending } = useConnect();
	return (
		<>
			<Panel size="big" name="With a wallet">
				{session.data ? (
					<>
						<Headline>Signed in</Headline>
						<p className="break-all font-mono text-[13px] text-neutral-300">
							{session.data.walletAddress}
						</p>
					</>
				) : (
					<>
						<Headline>Sign one message</Headline>
						<Note>Nothing is sent and nothing is spent.</Note>
						<div>
							<button type="button" disabled={pending} onClick={connect} className={BUTTON}>
								{pending ? "Check your wallet" : "Connect"}
							</button>
						</div>
					</>
				)}
			</Panel>
			<Panel size="large" name="With email">
				<Note>
					Email sign in, reaching the same account as your wallet, arrives with accounts. So does
					recovery: either one gets you back in.
				</Note>
			</Panel>
			<Panel size="wide" name="No wallet yet">
				<Onward to="/get-a-wallet">Where to get one</Onward>
			</Panel>
		</>
	);
}

export function WelcomeScreen() {
	return (
		<>
			<Panel size="big" name="Maschina">
				<Headline>Give software a job and money, safely, so it can go to work for you.</Headline>
				<div>
					<Onward to="/">Open the app</Onward>
				</div>
			</Panel>
			<Panel size="large" name="The guarantee">
				<Note>
					A machine can spend what you give it and nothing more, and its money can only ever go back
					to the wallet that made it.
				</Note>
			</Panel>
			<Panel size="wide" name="Read first">
				<Onward to="/papers">The papers</Onward>
			</Panel>
		</>
	);
}

export function GetAWalletScreen() {
	return (
		<>
			<Panel size="big" name="You need a Solana wallet">
				<Headline>A wallet is how you sign in</Headline>
				<Note>
					It is also how your machines send money home. It stays yours: Maschina never holds its
					key. Install one, refresh this page, and press Connect.
				</Note>
			</Panel>
			<Panel size="large" name="Pick one">
				<Away href="https://phantom.com">Phantom</Away>
				<Away href="https://solflare.com">Solflare</Away>
				<Away href="https://backpack.app">Backpack</Away>
			</Panel>
		</>
	);
}

export function InviteScreen() {
	return (
		<>
			<Panel size="big" name="You're invited">
				<Headline>The private beta</Headline>
				<Note>
					Invite codes arrive with the private beta. Beta machines can hold a limited amount while
					everything is proven with real people.
				</Note>
			</Panel>
			<Panel size="large" name="Meanwhile">
				<Onward to="/new">Make a machine on paper</Onward>
				<Onward to="/papers">Read the papers</Onward>
			</Panel>
		</>
	);
}

export function FeedbackScreen() {
	const [kind, setKind] = useState<"Bug" | "Idea">("Bug");
	const [text, setText] = useState("");
	const mail = `mailto:support@maschina.dev?subject=${encodeURIComponent(`${kind}: ${text.slice(0, 60)}`)}&body=${encodeURIComponent(`${text}\n\nPage: ${window.location.href}`)}`;
	return (
		<>
			<Panel size="big" name="Tell us">
				<div className="grid grid-cols-2 gap-1">
					{(["Bug", "Idea"] as const).map((each) => (
						<button
							key={each}
							type="button"
							aria-pressed={kind === each}
							onClick={() => setKind(each)}
							className={`py-2 text-[14px] transition-colors ${kind === each ? "bg-white text-neutral-950" : "bg-white/[0.06] text-neutral-300 hover:bg-white/[0.12]"}`}
						>
							{each === "Bug" ? "Something broke" : "An idea"}
						</button>
					))}
				</div>
				<textarea
					value={text}
					onChange={(event) => setText(event.target.value)}
					aria-label="What happened"
					rows={5}
					placeholder={
						kind === "Bug" ? "What happened, and what you expected" : "What you would like"
					}
					className="min-h-0 flex-1 resize-none bg-white/[0.06] p-3 text-[15px] text-neutral-100 outline-none placeholder:text-neutral-600"
				/>
			</Panel>
			<Panel size="large" name="Send">
				<div>
					<a href={mail} className={BUTTON}>
						Send
					</a>
				</div>
				<Note>
					It opens your mail app with this filled in, so nothing is sent until you press send there.
				</Note>
			</Panel>
		</>
	);
}

export function TermsScreen() {
	return (
		<Panel size="big" name="Terms of use">
			<Headline>Being written</Headline>
			<Note>
				The terms of use are being written, with a lawyer, before anyone else puts money in.
			</Note>
		</Panel>
	);
}

export function PrivacyScreen() {
	return (
		<Panel size="big" name="Privacy">
			<Headline>Being written</Headline>
			<Note>
				The privacy policy is being written, with a lawyer, before anyone else puts money in. In
				short: no tracking, no selling, and your data can be exported or deleted.
			</Note>
		</Panel>
	);
}
