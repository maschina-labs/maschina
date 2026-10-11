import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/decisions")({
	// Opened in the detail layer, which the root draws over the deck.
	component: () => null,
});
