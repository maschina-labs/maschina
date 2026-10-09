import { range } from "@maschina/runtime";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { finderReady, finderRequest } from "../lib/finder-form.ts";
import { useCreateMachine } from "../lib/machines.ts";
import { mostPerBuy, numberFrom, rangeReady, rangeRequest } from "../lib/range-form.ts";
import { useSession } from "../lib/session.ts";
import { toast } from "../lib/toasts.ts";
import { limitReady, limitRequest } from "../lib/trigger-form.ts";
import { Tile, TileEmpty } from "./bento.tsx";
import { useSolDay } from "./home.tsx";

/**
 * Making a machine, on its own screen, in the order a person decides: what kind of machine, how it is
 * set, paper or real money, what it is called and how much it works with, then make it. Paper is the
 * default: it trades against real prices and moves no money, so a first machine costs nothing.
 */

type Kind = "finder" | "fixed" | "trigger";

const KINDS: { id: Kind; name: string; says: string }[] = [
	{ id: "finder", name: "Range finder", says: "Buys dips and sells rises, and follows the price" },
	{
		id: "fixed",
		name: "Fixed range",
		says: "Buys at one price and sells at another, that you set",
	},
	{ id: "trigger", name: "Price trigger", says: "Buys once, when the price falls to your level" },
];

const CHOICE = (on: boolean) =>
	`w-full px-3 py-2 text-left transition-colors ${on ? "bg-white text-neutral-950" : "bg-white/[0.06] text-neutral-100 hover:bg-white/[0.12]"}`;
const FIELD = "flex items-center justify-between gap-3 bg-white/[0.06] px-3 py-2";
const INPUT =
	"min-w-0 flex-1 bg-transparent text-right font-display text-[17px] text-neutral-100 tabular-nums outline-none placeholder:text-neutral-600";
const LABEL = "text-[12px] text-neutral-500";

function Field({
	label,
	value,
	onChange,
	unit,
	placeholder,
}: {
	label: string;
	value: string;
	onChange: (value: string) => void;
	unit?: string;
	placeholder?: string;
}) {
	return (
		<label className={FIELD}>
			<span className={LABEL}>{label}</span>
			<input
				value={value}
				onChange={(event) => onChange(event.target.value)}
				placeholder={placeholder}
				inputMode={unit ? "decimal" : "text"}
				aria-label={label}
				className={INPUT}
			/>
			{unit ? <span className="text-[14px] text-neutral-400">{unit}</span> : null}
		</label>
	);
}

export function NewMachineScreen() {
	const { api } = useRouter().options.context;
	const session = useSession(api);
	const queryClient = useQueryClient();
	const create = useCreateMachine(api, queryClient);
	const navigate = useNavigate();
	const day = useSolDay();
	const price = day?.last;

	const [kind, setKind] = useState<Kind>("finder");
	const [paper, setPaper] = useState(true);
	const [name, setName] = useState("Range finder");
	const [money, setMoney] = useState("");
	const [bandPct, setBandPct] = useState(2.5);
	const [floorPct, setFloorPct] = useState<3 | 5 | 8>(8);
	const [buyAt, setBuyAt] = useState("");
	const [sellAt, setSellAt] = useState("");
	const [level, setLevel] = useState("");

	if (!session.data) {
		return (
			<Tile size="big" label="Connect">
				<TileEmpty>Connect your wallet to make a machine.</TileEmpty>
			</Tile>
		);
	}

	// What will actually be sent, and whether it is ready to send.
	const finder = { name, float: money, bandPct, floorPct };
	const fixed = { name, kind: range.kind, buyAt, sellAt, perBuy: mostPerBuy(money), float: money };
	const trigger = { level, spend: money, paper };
	const ready =
		kind === "finder"
			? finderReady(finder)
			: kind === "fixed"
				? rangeReady(fixed)
				: limitReady(trigger) && name.trim() !== "";

	const make = () => {
		const request =
			kind === "finder"
				? { ...finderRequest(finder), paper }
				: kind === "fixed"
					? { ...rangeRequest(fixed), paper }
					: { ...limitRequest(trigger), name, paper };
		create.mutate(request, {
			onSuccess: (made) => {
				toast(`${name} made${paper ? ", on paper" : ""}`);
				void navigate({ to: `/machines/${made.machineId}`, replace: true });
			},
			onError: (error) => toast(error.message, "problem"),
		});
	};

	// Where it would trade, against the price right now.
	const half = bandPct / 200;
	const preview =
		kind === "finder" && price
			? [
					["Buys at", price * (1 - half)],
					["Sells at", price * (1 - half) * (1 + bandPct / 100)],
					["Floor", price * (1 - half) * (1 - floorPct / 100)],
				]
			: kind === "fixed"
				? [
						["Buys at", numberFrom(buyAt)],
						["Sells at", numberFrom(sellAt)],
					]
				: [["Buys at", numberFrom(level)]];

	return (
		<>
			<Tile size="large" label="Kind">
				<div className="flex h-full flex-col justify-between gap-2 p-3">
					<fieldset className="flex flex-col gap-1.5">
						<legend className="sr-only">Kind of machine</legend>
						{KINDS.map((each) => (
							<button
								key={each.id}
								type="button"
								aria-pressed={kind === each.id}
								onClick={() => {
									setKind(each.id);
									setName(each.name);
								}}
								className={CHOICE(kind === each.id)}
							>
								<span className="block font-display text-[15px] leading-tight">{each.name}</span>
								<span
									className={`block text-[13px] ${kind === each.id ? "text-neutral-600" : "text-neutral-500"}`}
								>
									{each.says}
								</span>
							</button>
						))}
					</fieldset>
					<span className={LABEL}>1 · What kind</span>
				</div>
			</Tile>

			<Tile size="big" label="Settings">
				<div className="flex h-full flex-col justify-between gap-3 p-4">
					<div className="flex flex-col gap-2">
						{kind === "finder" ? (
							<>
								<label className={FIELD}>
									<span className={LABEL}>Band width</span>
									<input
										type="range"
										min={1}
										max={5}
										step={0.1}
										value={bandPct}
										onChange={(event) => setBandPct(Number(event.target.value))}
										aria-label="Band width"
										className="square mx-4 flex-1"
									/>
									<span className="w-14 text-right font-display text-[20px] text-neutral-100 tabular-nums">
										{bandPct.toFixed(1)}%
									</span>
								</label>
								<div className={FIELD}>
									<span className={LABEL}>Floor under each buy</span>
									<div className="flex gap-1.5">
										{([3, 5, 8] as const).map((each) => (
											<button
												key={each}
												type="button"
												aria-pressed={floorPct === each}
												onClick={() => setFloorPct(each)}
												className={`px-3 py-1 font-display text-[15px] ${floorPct === each ? "bg-white text-neutral-950" : "bg-white/[0.08] text-neutral-200"}`}
											>
												{each}%
											</button>
										))}
									</div>
								</div>
							</>
						) : kind === "fixed" ? (
							<>
								<Field
									label="Buy at"
									value={buyAt}
									onChange={setBuyAt}
									unit="USD"
									placeholder={price ? (price * 0.99).toFixed(2) : ""}
								/>
								<Field
									label="Sell at"
									value={sellAt}
									onChange={setSellAt}
									unit="USD"
									placeholder={price ? (price * 1.015).toFixed(2) : ""}
								/>
							</>
						) : (
							<Field
								label="Buy when SOL falls to"
								value={level}
								onChange={setLevel}
								unit="USD"
								placeholder={price ? (price * 0.98).toFixed(2) : ""}
							/>
						)}
					</div>
					<div className="flex flex-col gap-2">
						<ul className="flex flex-wrap gap-x-8 gap-y-1">
							{preview.map(([label, value]) => (
								<li key={String(label)} className="flex items-baseline gap-2">
									<span className={LABEL}>{label}</span>
									<span className="font-display text-[20px] text-neutral-100 tabular-nums">
										{Number.isFinite(value) && Number(value) > 0 ? Number(value).toFixed(2) : "-"}
									</span>
								</li>
							))}
						</ul>
						<span className={LABEL}>
							2 · How it is set{price ? ` · SOL is ${price.toFixed(2)} now` : ""}
							{kind === "finder" ? " · after each sale the band moves to follow the price" : ""}
						</span>
					</div>
				</div>
			</Tile>

			<Tile size="wide" label="Paper or live">
				<div className="flex h-full flex-col justify-between gap-2 p-3">
					<div className="flex gap-1.5">
						<button
							type="button"
							aria-pressed={paper}
							onClick={() => setPaper(true)}
							className={CHOICE(paper)}
						>
							<span className="block font-display text-[15px] leading-tight">Paper</span>
							<span
								className={`block text-[13px] ${paper ? "text-neutral-600" : "text-neutral-500"}`}
							>
								Free, no money moves
							</span>
						</button>
						<button
							type="button"
							aria-pressed={!paper}
							onClick={() => setPaper(false)}
							className={CHOICE(!paper)}
						>
							<span className="block font-display text-[15px] leading-tight">Live</span>
							<span
								className={`block text-[13px] ${!paper ? "text-neutral-600" : "text-neutral-500"}`}
							>
								Real money, its own wallet
							</span>
						</button>
					</div>
					<span className={LABEL}>3 · Paper or live</span>
				</div>
			</Tile>

			<Tile size="wide" label="Name and money">
				<div className="flex h-full flex-col justify-between gap-2 p-3">
					<div className="flex flex-col gap-1.5">
						<Field label="Name" value={name} onChange={setName} />
						<Field
							label={kind === "trigger" ? "Spend" : "Works with"}
							value={money}
							onChange={setMoney}
							unit="USDC"
							placeholder="40"
						/>
					</div>
					<span className={LABEL}>4 · Name and money</span>
				</div>
			</Tile>

			<Tile size="wide" label="Make it">
				<div className="flex h-full flex-col justify-between gap-2 p-3">
					<button
						type="button"
						disabled={!ready || create.isPending}
						onClick={make}
						className="w-full bg-white px-4 py-3 font-display text-[17px] text-neutral-950 transition-opacity disabled:opacity-30"
					>
						{create.isPending ? "Making its wallet" : paper ? "Make it, on paper" : "Make it"}
					</button>
					<span className={LABEL}>
						{paper
							? "5 · It starts on paper. Nothing to fund."
							: "5 · Then fund it from your wallet and start it."}
					</span>
				</div>
			</Tile>
		</>
	);
}
