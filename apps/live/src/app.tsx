import { useEffect } from "react";

/**
 * The live record, blank until its design lands (the last version, with the table of trades, is in git at 145cfb8).
 * What it will run on is kept: `record.ts` reads and checks the gateway's open route, and `format.ts` writes amounts
 * exactly. It lives at live.maschina.dev; maschina.dev/live is redirected to it.
 */
export function LiveApp() {
	useEffect(() => {
		document.title = "Live Record | Maschina";
	}, []);
	return <main aria-label="Live Record" className="min-h-dvh bg-black" />;
}
