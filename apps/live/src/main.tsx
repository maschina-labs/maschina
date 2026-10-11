import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import { LiveApp } from "./app.tsx";
import { type RecordState, readRecord } from "./record.ts";

const gateway = import.meta.env.VITE_GATEWAY_URL ?? "https://api.maschina.dev";
// The gateway caches the record for 30 seconds, so asking more often only asks for the same answer.
const EVERY_MS = 30_000;

function Live() {
	const [state, setState] = useState<RecordState>({ status: "loading" });
	useEffect(() => {
		let stopped = false;
		const load = async () => {
			const result = await readRecord(gateway);
			if (stopped) return;
			// A failed read keeps the trades already on screen rather than blanking them.
			setState((was) =>
				result.ok
					? { status: "ready", trades: result.trades }
					: was.status === "ready"
						? was
						: { status: "failed" },
			);
		};
		void load();
		const timer = setInterval(load, EVERY_MS);
		return () => {
			stopped = true;
			clearInterval(timer);
		};
	}, []);
	return <LiveApp state={state} />;
}

const root = document.getElementById("root");
if (!root) throw new Error("#root is missing from index.html");
createRoot(root).render(
	<StrictMode>
		<Live />
	</StrictMode>,
);
