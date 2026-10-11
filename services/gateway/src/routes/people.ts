/**
 * Better Auth's own routes, answered under /v1/auth/people.
 *
 * Sign up, sign in, confirming an address, choosing a new password, Google, GitHub and a company's single sign-on
 * are all Better Auth's. The gateway only hands the request over as it came and returns what comes back, so a link
 * in an email and a redirect from Google reach it exactly as they were sent. When it is not switched on the route
 * says so, rather than pretending.
 */

import { Hono } from "hono";

/** Better Auth, as the gateway sees it: a request in, a response out. */
export type PeopleDesk = { handler(request: Request): Promise<Response> };

export function peopleRoutes(desk: PeopleDesk | undefined) {
	return new Hono().all("/auth/people/*", async (c) => {
		if (!desk) {
			return c.json(
				{
					error: {
						code: "unavailable",
						message: "signing in with an email or another account is not available here yet",
					},
				},
				503,
			);
		}
		return desk.handler(c.req.raw);
	});
}
