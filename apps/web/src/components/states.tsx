/**
 * The pages nobody designs, which are the ones people remember.
 *
 * A product that handles money is judged hardest when something has gone wrong, so every one of these
 * says three things: what happened, what it means for your money, and the one thing to do next. None of
 * them says "oops" and none of them hides the real error, because the person reading it is the person who
 * can act on it.
 *
 * The line about funds is not decoration. Somebody whose screen just broke wants to know their money is
 * still theirs before they want anything else, and it is: a machine's wallet can only ever pay its owner,
 * enforced by the wallet's own policy rather than by this code.
 */

import type { Icon } from "@phosphor-icons/react";
import {
	ArrowClockwise,
	CloudSlash,
	House,
	Lock,
	MagnifyingGlass,
	Plugs,
	ShieldCheck,
	Wrench,
} from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { LogoMark } from "./brand.tsx";
import { Button } from "./ui.tsx";

/**
 * A whole page for a state, used when there is no screen left to sit inside.
 *
 * Centred, quiet, and small. The mark is at the top so the page still looks like the product rather than
 * a browser error.
 */
function StatePage({
	icon: Glyph,
	code,
	title,
	note,
	detail,
	actions,
}: {
	icon: Icon;
	/** The short technical name for this, in mono. Somebody will quote it in a message. */
	code: string;
	title: string;
	note: string;
	detail?: string | undefined;
	actions?: ReactNode;
}) {
	return (
		<main className="flex min-h-dvh flex-col items-center justify-center bg-background px-6 py-16">
			<div className="w-full max-w-[420px]">
				<div className="mb-8 flex items-center gap-1.5 text-text-faint">
					<LogoMark className="size-[13px]" />
					<span className="font-display font-semibold text-[10px] tracking-[0.04em]">MASCHINA</span>
				</div>

				<div className="flex size-9 items-center justify-center rounded-lg border border-line bg-surface text-text-muted">
					<Glyph size={17} />
				</div>

				<p className="mt-5 font-mono text-[11px] text-text-faint uppercase tracking-[0.1em]">
					{code}
				</p>
				<h1 className="mt-1.5 font-medium text-[19px] text-text tracking-[-0.01em]">{title}</h1>
				<p className="mt-2 text-[13px] text-text-muted leading-relaxed">{note}</p>

				{detail ? (
					<pre className="mt-4 overflow-x-auto rounded-md border border-line bg-inset px-3 py-2.5 font-mono text-[11px] text-text-faint leading-relaxed">
						{detail}
					</pre>
				) : null}

				{actions ? <div className="mt-6 flex flex-wrap items-center gap-2">{actions}</div> : null}

				<p className="mt-8 flex items-start gap-2 border-line border-t pt-5 text-[11.5px] text-text-faint leading-relaxed">
					<ShieldCheck size={14} className="mt-[1px] shrink-0" />
					Your funds are unaffected. A machine's wallet can only ever pay the wallet that made it,
					and that is enforced by the wallet, not by this page.
				</p>
			</div>
		</main>
	);
}

const home = (
	<Link to="/">
		<Button icon={House}>Machines</Button>
	</Link>
);

/** A route that does not exist. */
export function NotFound() {
	return (
		<StatePage
			icon={MagnifyingGlass}
			code="404 · not found"
			title="There is nothing at this address"
			note="The page may have been renamed, or the machine it belonged to may have been stopped and removed. Nothing has happened to anything you own."
			actions={home}
		/>
	);
}

/** Something threw where it should not have. */
export function Broken({
	detail,
	reset,
}: {
	detail?: string | undefined;
	reset?: (() => void) | undefined;
}) {
	return (
		<StatePage
			icon={Wrench}
			code="error · unhandled"
			title="This screen broke"
			note="The fault is in the page rather than in your machines, which carry on running whether anybody is watching or not. The real error is below, and it is worth sending."
			detail={detail}
			actions={
				<>
					{reset ? (
						<Button tone="primary" icon={ArrowClockwise} onClick={reset}>
							Reload this screen
						</Button>
					) : null}
					{home}
				</>
			}
		/>
	);
}

/** The API cannot be reached at all. */
export function Offline({ retry }: { retry?: (() => void) | undefined }) {
	return (
		<StatePage
			icon={CloudSlash}
			code="503 · unreachable"
			title="Maschina's API is not answering"
			note="Your machines run on the server rather than in this browser, so they are unaffected by this. What is missing is the ability to read or change them from here."
			actions={
				retry ? (
					<Button tone="primary" icon={ArrowClockwise} onClick={retry}>
						Try again
					</Button>
				) : (
					home
				)
			}
		/>
	);
}

/** Signed out, or a session that has ended. */
export function SignedOut({ connect }: { connect?: (() => void) | undefined }) {
	return (
		<StatePage
			icon={Lock}
			code="401 · not signed in"
			title="This needs a connected wallet"
			note="Signing in is a signature over a sentence, never a transaction and never a permission to spend. Maschina reads which wallet signed it and nothing else."
			actions={
				connect ? (
					<Button tone="primary" icon={Plugs} onClick={connect}>
						Connect wallet
					</Button>
				) : (
					home
				)
			}
		/>
	);
}

/** Somebody else's machine. */
export function NotYours() {
	return (
		<StatePage
			icon={Lock}
			code="403 · not yours"
			title="This belongs to another wallet"
			note="Every machine is owned by the wallet that made it, and only that wallet can read what it did or tell it to stop."
			actions={home}
		/>
	);
}
