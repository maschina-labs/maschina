import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Coming, Copy, Later, Page, Part, Row } from "../components/page.tsx";
import { TypeRow } from "../components/slider-row.tsx";
import { WalletButton } from "../components/wallet-button.tsx";

export const Route = createFileRoute("/sign-in")({
	component: SignIn,
});

/** Every way in: a wallet now, and email, a passkey and a second factor once accounts exist (A3). */
function SignIn() {
	const [email, setEmail] = useState("");
	return (
		<Page code="ACCOUNT // SIGN IN" title="SIGN IN">
			<Part title="WITH A WALLET">
				<Copy>SIGN ONE MESSAGE. NOTHING IS SENT AND NOTHING IS SPENT.</Copy>
				<div>
					<WalletButton />
				</div>
			</Part>
			<Part title="WITH EMAIL">
				<div className="flex max-w-[420px] flex-col gap-1.5">
					<TypeRow label="EMAIL" value={email} onChange={setEmail} />
				</div>
				<Later>SEND ME A LINK</Later>
				<Coming>EMAIL SIGN IN ARRIVES WITH ACCOUNTS, FOR ANYONE WITHOUT A WALLET YET.</Coming>
			</Part>
			<Part title="WITH A PASSKEY">
				<Later>USE A PASSKEY</Later>
				<Coming>
					FACE ID, A FINGERPRINT OR A SECURITY KEY. IT ALSO UNLOCKS THE MASCHINA WALLET, LATER.
				</Coming>
			</Part>
			<Part title="KEEPING IT SAFE">
				<Row term="TWO FACTOR" value="WITH ACCOUNTS" />
				<Row term="LINK ANOTHER WALLET" value="WITH ACCOUNTS" />
				<Row term="RECOVER AN ACCOUNT" value="WITH ACCOUNTS" />
			</Part>
		</Page>
	);
}
