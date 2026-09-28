import { createFileRoute } from "@tanstack/react-router";
import { Coming, Copy, Later, Page, Part, Row } from "../components/page.tsx";

export const Route = createFileRoute("/wallet/stake")({
	component: Stake,
});

/** Staking idle SOL. Liquid staking first, because it is a swap: SOL in, a staking token back. */
function Stake() {
	return (
		<Page code="WALLET // STAKE" title="STAKE IDLE SOL">
			<Part title="HOW IT WORKS">
				<Copy>
					SWAP IDLE SOL FOR A LIQUID STAKING TOKEN, LIKE JITOSOL. IT EARNS STAKING REWARDS AND CAN
					BE SWAPPED BACK AT ANY TIME. THE YIELD PARKER MACHINE DOES THIS FOR YOU, AUTOMATICALLY.
				</Copy>
			</Part>
			<Part title="RATES">
				<Row term="JITOSOL" value="-" />
				<Coming>LIVE RATES ARRIVE WITH THE BACKEND PASS.</Coming>
			</Part>
			<Later>STAKE</Later>
		</Page>
	);
}
