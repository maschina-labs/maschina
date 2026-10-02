import { ArrowClockwise, House, WifiSlash } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { type ReactNode, useEffect, useState } from "react";

/**
 * The screens nobody wants to see, made quiet: a page that does not exist, something that broke, a
 * session that ended, and a connection that dropped. Each says plainly what happened and offers the
 * one thing to do next.
 */

function Notice({
	code,
	title,
	children,
	action,
}: {
	code: string;
	title: string;
	children: ReactNode;
	action: ReactNode;
}) {
	return (
		<div className="col-span-2 row-span-2 flex flex-col justify-between bg-white/[0.09] p-6 md:col-span-4">
			<div className="flex flex-col gap-3">
				<span className="text-[13px] text-neutral-500">{code}</span>
				<h2 className="font-display text-[clamp(24px,3vw,40px)] text-neutral-100 leading-tight">
					{title}
				</h2>
				<p className="max-w-[46ch] text-[15px] text-neutral-400 leading-relaxed">{children}</p>
			</div>
			<div>{action}</div>
		</div>
	);
}

const BUTTON =
	"inline-flex items-center gap-2.5 bg-white/[0.11] px-4 py-3 font-display text-[15px] text-neutral-100 transition-colors hover:bg-white/[0.18]";

/** An address that leads nowhere. */
export function NotFound() {
	return (
		<Notice
			code="404"
			title="There is nothing here"
			action={
				<Link to="/" className={BUTTON}>
					<House size={18} weight="light" />
					Home
				</Link>
			}
		>
			The address may be mistyped, or what was here has moved. Your machines are fine.
		</Notice>
	);
}

/** Something broke. The real message, because whoever reads it is whoever can fix it. */
export function Broken({ detail, retry }: { detail: string; retry: () => void }) {
	return (
		<div className="flex h-dvh items-center justify-center px-5">
			<div className="flex w-full max-w-[560px] flex-col gap-4 bg-[oklch(0.15_0_0)] p-7">
				<span className="text-[13px] text-neutral-500">500</span>
				<h1 className="font-display text-[30px] text-neutral-100 leading-tight">
					Something broke on this screen
				</h1>
				<p className="text-[15px] text-neutral-400 leading-relaxed">
					Your machines keep running: they do not depend on this page. What went wrong:
				</p>
				<code className="break-words bg-white/[0.06] px-3 py-2 font-mono text-[13px] text-neutral-300">
					{detail}
				</code>
				<div className="flex gap-2">
					<button type="button" onClick={retry} className={BUTTON}>
						<ArrowClockwise size={18} weight="light" />
						Try again
					</button>
					<a href="/" className={BUTTON}>
						<House size={18} weight="light" />
						Home
					</a>
				</div>
			</div>
		</div>
	);
}

/** Signed in once, and the session has run out. */
export function SessionEnded({ onConnect }: { onConnect: () => void }) {
	return (
		<Notice
			code="401"
			title="Your session ended"
			action={
				<button type="button" onClick={onConnect} className={BUTTON}>
					Connect again
				</button>
			}
		>
			For safety a session lasts a while, then asks again. Connect your wallet to carry on where you
			were.
		</Notice>
	);
}

/** A quiet line across the top while the connection is down, gone the moment it is back. */
export function OfflineBanner() {
	const [online, setOnline] = useState(() =>
		typeof navigator === "undefined" ? true : navigator.onLine,
	);
	useEffect(() => {
		const up = () => setOnline(true);
		const down = () => setOnline(false);
		window.addEventListener("online", up);
		window.addEventListener("offline", down);
		return () => {
			window.removeEventListener("online", up);
			window.removeEventListener("offline", down);
		};
	}, []);
	if (online) return null;
	return (
		<div
			role="status"
			className="fixed inset-x-0 top-0 z-[80] flex items-center justify-center gap-2.5 bg-[oklch(0.17_0_0)] px-4 py-2.5 font-display text-[14px] text-neutral-200"
		>
			<WifiSlash size={16} weight="light" />
			Offline. Figures will catch up when the connection is back; your machines keep running.
		</div>
	);
}
