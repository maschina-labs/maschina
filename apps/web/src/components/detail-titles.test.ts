import { describe, expect, it } from "vitest";
import { titleFor } from "./detail.tsx";

describe("what each screen is called", () => {
	it.each([
		["/market/sol", "SOL"],
		["/profit", "Profit"],
		["/vault", "Vault"],
		["/fleet", "Your machines"],
		["/decisions", "Decisions"],
		["/trades", "Trades"],
		["/feed", "Activity"],
		["/feedback", "Feedback"],
		["/machines/abc", "Machine"],
		["/m/abc", "Machine"],
		["/new", "New machine"],
		["/settings", "Settings"],
		["/settings/alerts", "Alerts"],
		["/settings/keys", "Keys"],
		["/wallet", "Wallet"],
		["/wallet/stake", "Stake"],
		["/marketplace/abc", "Listing"],
		["/network/join", "Run a node"],
		["/network/abc", "Node"],
		["/teams", "Teams"],
		["/teams/abc", "Team"],
		["/u/ash", "Profile"],
		["/manager", "Manager"],
		["/sign-in", "Sign in"],
		["/welcome", "Welcome"],
		["/papers", "Papers"],
		["/invite", "Invite"],
		["/get-a-wallet", "Get a wallet"],
		["/legal/terms", "Terms"],
		["/legal/privacy", "Privacy"],
		["/maintenance", "Maintenance"],
	])("%s is %s", (path, title) => {
		expect(titleFor(path)).toBe(title);
	});

	it("does not take one address for another that starts the same way", () => {
		expect(titleFor("/newsletter")).toBe("Not found");
		expect(titleFor("/feeds")).toBe("Not found");
		expect(titleFor("/profits")).toBe("Not found");
		expect(titleFor("/nothing-here")).toBe("Not found");
	});
});
