import { useQuery } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { amount, useMachines } from "../lib/machines.ts";
import { fetchPrice } from "../lib/price.ts";
import { useSession } from "../lib/session.ts";
import { GLASS } from "./glass.ts";

/**
 * A thin data bar along the bottom of the screen, like the status bar in JetBrains' editors: the network,
 * SOL, and how your machines stand, always in view.
 */

const ITEM = "flex items-center gap-1.5 whitespace-nowrap";

export type StatusFigures = {
	price: number | undefined;
	change24h: number | undefined;
	running: number | undefined;
	machines: number | undefined;
	realised: string | undefined;
};

export function StatusBarView({ price, change24h, running, machines, realised }: StatusFigures) {
	return (
		<footer
			className={`flex h-6 shrink-0 items-center gap-5 px-3 text-[10px] text-neutral-500 tracking-[0.12em] ${GLASS}`}
		>
			<span className={ITEM}>SOLANA MAINNET</span>
			<span className={ITEM}>
				SOL{" "}
				<span className="text-neutral-200 tabular-nums">
					{price === undefined ? "…" : price.toFixed(2)}
				</span>
				{change24h === undefined || change24h === 0 ? null : (
					<span className="text-neutral-200">{change24h > 0 ? "▲" : "▼"}</span>
				)}
			</span>
			{machines === undefined ? null : (
				<>
					<span className={ITEM}>
						<span className="text-neutral-200 tabular-nums">{running}</span> OF {machines} RUNNING
					</span>
					<span className={`${ITEM} hidden sm:flex`}>
						REALISED <span className="text-neutral-200 tabular-nums">{realised}</span> USDC
					</span>
				</>
			)}
		</footer>
	);
}

export function StatusBar() {
	const { api } = useRouter().options.context;
	const session = useSession(api);
	const machines = useMachines(api);
	// The same query as the terminal's price, so both read one answer.
	const price = useQuery({
		queryKey: ["sol-price"],
		queryFn: () => fetchPrice(),
		refetchInterval: 5_000,
	});
	const mine = session.data ? machines.data : undefined;
	return (
		<StatusBarView
			price={price.data?.usd}
			change24h={price.data?.change24h}
			running={mine?.filter((machine) => machine.state === "running").length}
			machines={mine?.length}
			realised={
				mine
					? amount(mine.reduce((sum, m) => sum + BigInt(m.result.realised), 0n).toString())
					: undefined
			}
		/>
	);
}
