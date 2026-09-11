import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
// The shared surface first, so anything in index.css that has not been ported yet
// still wins. index.css shrinks to nothing as surfaces move onto the primitives.
import "@maschina/ui/styles.css";
import "./index.css";

const container = document.getElementById("root");
if (!container) throw new Error("#root is missing from index.html");

createRoot(container).render(
	<StrictMode>
		<App />
	</StrictMode>,
);
