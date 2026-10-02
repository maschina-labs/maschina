import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/profit")({
	// Opened in the detail layer, which the root draws over the deck.
	component: () => null,
});
