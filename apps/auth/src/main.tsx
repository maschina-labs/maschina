import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import { AuthApp } from "./app.tsx";

const root = document.getElementById("root");
if (!root) throw new Error("#root is missing from index.html");

createRoot(root).render(
	<StrictMode>
		<AuthApp path={window.location.pathname} />
	</StrictMode>,
);
