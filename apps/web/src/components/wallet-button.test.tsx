import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WalletButtonView } from "./wallet-button.tsx";

const owner = { ownerId: "o", walletAddress: "8GTgV1mscEjSoNmTdmNLaPjV1LTCRbRVHn7eh1UCetpR" };
const view = (props: Partial<Parameters<typeof WalletButtonView>[0]> = {}) =>
	render(
		<WalletButtonView
			owner={null}
			signingIn={false}
			onSignIn={vi.fn()}
			onSignOut={vi.fn()}
			{...props}
		/>,
	);

describe("the wallet button", () => {
	it("offers to connect when nobody is signed in", () => {
		const onSignIn = vi.fn();
		view({ onSignIn });

		fireEvent.click(screen.getByRole("button", { name: "Connect" }));
		expect(onSignIn).toHaveBeenCalledOnce();
	});

	it("waits for the session before offering to connect", () => {
		view({ owner: undefined });

		expect(screen.getByRole("button", { name: "Connect" })).toBeDisabled();
	});

	it("says to look at the wallet while it is signing", () => {
		view({ signingIn: true });

		expect(screen.getByRole("button", { name: "Check your wallet" })).toBeDisabled();
	});

	it("offers to disconnect once signed in, without showing the address", () => {
		const onSignOut = vi.fn();
		view({ owner, onSignOut });

		fireEvent.click(screen.getByRole("button", { name: "Disconnect" }));
		expect(onSignOut).toHaveBeenCalledOnce();
		expect(screen.queryByText(/8GTg/)).not.toBeInTheDocument();
	});
});
