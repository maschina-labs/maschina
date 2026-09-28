import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

/**
 * The pages people rarely see, written as carefully as the rest: not found, something broke, not yours, and
 * a session that ended. The real message always shows, because whoever reads it may be the one who fixes it.
 */

function Status({
	code,
	title,
	detail,
	children,
}: {
	code: string;
	title: string;
	detail?: string;
	children?: React.ReactNode;
}) {
	return (
		<div role="alert" className="flex min-h-[60vh] flex-col items-start justify-center gap-4 px-6">
			<span className="text-[10px] text-neutral-500 tracking-[0.18em]">{code}</span>
			<h1 className="text-[22px] text-neutral-100 tracking-[0.12em]">{title}</h1>
			{detail ? (
				<p className="max-w-[560px] text-[11px] text-neutral-500 leading-relaxed tracking-[0.08em]">
					{detail}
				</p>
			) : null}
			<div className="flex gap-4 pt-2 text-[11px] tracking-[0.14em]">{children}</div>
		</div>
	);
}

const home = (
	<Link to="/" className="text-neutral-200 hover:text-neutral-50">
		GO TO THE TERMINAL →
	</Link>
);

export const NotFound = () => (
	<Status code="404 // NOTHING HERE" title="NOTHING AT THIS ADDRESS">
		{home}
	</Status>
);

export const Broken = ({ detail, retry }: { detail: string; retry?: () => void }) => (
	<Status code="500 // SOMETHING BROKE" title="THIS PAGE BROKE" detail={detail}>
		{retry ? (
			<button type="button" onClick={retry} className="text-neutral-200 hover:text-neutral-50">
				TRY AGAIN
			</button>
		) : null}
		{home}
	</Status>
);

export const NotYours = () => (
	<Status
		code="403 // NOT YOURS"
		title="THIS MACHINE BELONGS TO SOMEONE ELSE"
		detail="ONLY ITS OWNER CAN SEE IT, UNLESS THEY MAKE IT PUBLIC."
	>
		{home}
	</Status>
);

export const SessionEnded = () => (
	<Status
		code="401 // SESSION ENDED"
		title="CONNECT AGAIN"
		detail="YOUR SESSION ENDED. CONNECT YOUR WALLET TO CARRY ON; NOTHING WAS LOST."
	>
		<Link to="/sign-in" className="text-neutral-200 hover:text-neutral-50">
			SIGN IN →
		</Link>
	</Status>
);

/** A strip across the top when the connection drops, so a still screen is never mistaken for a quiet market. */
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
			className="fixed inset-x-0 top-0 z-[60] bg-neutral-100 py-1 text-center text-[10.5px] text-neutral-950 tracking-[0.16em]"
		>
			OFFLINE · NOTHING ON SCREEN IS LIVE UNTIL THE CONNECTION COMES BACK
		</div>
	);
}
