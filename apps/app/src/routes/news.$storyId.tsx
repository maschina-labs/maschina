import { createFileRoute } from "@tanstack/react-router";

// A story from the news, read in the detail layer over Home.
export const Route = createFileRoute("/news/$storyId")({
	component: () => null,
});
