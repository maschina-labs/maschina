import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/trades")({
	// Opened in the detail layer, which the root draws over the deck.
	component: () => null,
});
