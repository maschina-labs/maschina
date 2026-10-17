import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import { LiveApp } from "./app.tsx";
import { GATEWAY } from "./gateway.ts";

const root = document.getElementById("root");
if (!root) throw new Error("#root is missing from index.html");

createRoot(root).render(
	<StrictMode>
		<LiveApp gateway={GATEWAY} />
	</StrictMode>,
);
