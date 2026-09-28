import { createFileRoute } from "@tanstack/react-router";
import { Copy, Page, Part, Row } from "../components/page.tsx";

export const Route = createFileRoute("/get-a-wallet")({
	component: GetAWallet,
});

/** Shown when connecting finds no Solana wallet in the browser: what one is, and where to get one. */
function GetAWallet() {
	return (
		<Page code="ACCOUNT // NO WALLET FOUND" title="YOU NEED A SOLANA WALLET">
			<Copy>
				A WALLET IS HOW YOU SIGN IN AND HOW YOUR MACHINES SEND MONEY HOME. IT STAYS YOURS: MASCHINA
				NEVER HOLDS ITS KEY.
			</Copy>
			<Part title="PICK ONE">
				<Row
					term="PHANTOM"
					value={
						<a href="https://phantom.com" target="_blank" rel="noreferrer">
							PHANTOM.COM ↗
						</a>
					}
				/>
				<Row
					term="SOLFLARE"
					value={
						<a href="https://solflare.com" target="_blank" rel="noreferrer">
							SOLFLARE.COM ↗
						</a>
					}
				/>
				<Row
					term="BACKPACK"
					value={
						<a href="https://backpack.app" target="_blank" rel="noreferrer">
							BACKPACK.APP ↗
						</a>
					}
				/>
			</Part>
			<Copy>
				INSTALL ONE, REFRESH THIS PAGE, AND PRESS CONNECT. A MASCHINA WALLET UNLOCKED WITH A PASSKEY
				ARRIVES LATER.
			</Copy>
		</Page>
	);
}
