import { createFileRoute } from "@tanstack/react-router";

// Drawn by the detail layer, like every screen that is not a section.
export const Route = createFileRoute("/welcome")({
	component: () => null,
});
