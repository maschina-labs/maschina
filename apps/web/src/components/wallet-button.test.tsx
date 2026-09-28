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
			onOpen={vi.fn()}
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

	it("opens the wallet once signed in, without showing the address", () => {
		const onOpen = vi.fn();
		view({ owner, onOpen });

		fireEvent.click(screen.getByRole("button", { name: "Wallet" }));
		expect(onOpen).toHaveBeenCalledOnce();
		expect(screen.queryByText(/8GTg/)).not.toBeInTheDocument();
	});
});

describe("the wallet button, wired up", () => {
	it("opens the wallet panel when pressed", async () => {
		vi.resetModules();
		vi.doMock("@tanstack/react-router", () => ({
			useRouter: () => ({ options: { context: { api: {} } } }),
			useNavigate: () => vi.fn(),
		}));
		vi.doMock("@tanstack/react-query", () => ({ useQueryClient: () => ({}) }));
		vi.doMock("../lib/session.ts", () => ({
			useSession: () => ({ isPending: false, data: owner }),
			useSignIn: () => ({ isPending: false, mutate: vi.fn() }),
			useSignOut: () => ({ mutate: vi.fn() }),
		}));
		vi.doMock("../lib/machines.ts", () => ({
			useMachines: () => ({ data: [] }),
			amount: () => "0",
		}));
		const { WalletButton } = await import("./wallet-button.tsx");
		render(<WalletButton />);

		fireEvent.click(screen.getByRole("button", { name: "Wallet" }));
		expect(await screen.findByRole("complementary", { name: "Wallet" })).toBeInTheDocument();
	});
});
