/** Keeps existing public-record links working after the move to the company site. */
export async function handle(request: Request): Promise<Response> {
	const source = new URL(request.url);
	const destination = new URL("https://maschina.dev/live");
	destination.search = source.search;
	return Response.redirect(destination.href, 308);
}

export default { fetch: handle };
