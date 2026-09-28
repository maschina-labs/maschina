import { range } from "@maschina/runtime";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useCreateMachine } from "../lib/machines.ts";
import { fetchPrice } from "../lib/price.ts";
import { bandOf, mostPerBuy, numberFrom, rangeReady, rangeRequest } from "../lib/range-form.ts";
import { PriceChart } from "./price-chart.tsx";
import { SliderRow, TypeRow } from "./slider-row.tsx";

/**
 * Making a range machine by tuning it, not filling a form: glass rows you drag, starting from the live
 * price, with the band drawn on the real candles as it moves. The checks are the same ones the form
 * always had: a band that pays for itself, and a buy that leaves room in the float for its fee.
 */

export type RangeForm = {
	name: string;
	buyAt: string;
	sellAt: string;
	perBuy: string;
	float: string;
};

const LABEL = "text-[10.5px] text-neutral-500 tracking-[0.14em]";
const two = (n: number) => n.toFixed(2);

/** Where a new band starts: buy just under the price, sell two percent above that. */
export function startingBand(price: number): { buyAt: string; sellAt: string } {
	const buy = Math.floor(price * 0.992 * 100) / 100;
	return { buyAt: two(buy), sellAt: two(Math.ceil(buy * 1.02 * 100) / 100) };
}

export function NewMachineView({
	form,
	price,
	onChange,
	onCreate,
	creating,
	error,
}: {
	form: RangeForm;
	/** The live SOL price, which the sliders are ranged around. */
	price: number | undefined;
	onChange: (form: RangeForm) => void;
	onCreate: () => void;
	creating: boolean;
	error: string | undefined;
}) {
	const set = (key: keyof RangeForm) => (value: string) => onChange({ ...form, [key]: value });
	const band = bandOf(form.buyAt, form.sellAt);
	const most = numberFrom(mostPerBuy(form.float));
	const buy = numberFrom(form.buyAt);
	const sell = numberFrom(form.sellAt);
	const around = price ?? (Number.isFinite(buy) ? buy : 100);
	return (
		<form
			aria-label="New machine"
			onSubmit={(event) => {
				event.preventDefault();
				onCreate();
			}}
			className="flex flex-col gap-1.5"
		>
			<TypeRow label="NAME" value={form.name} onChange={set("name")} />
			<TypeRow label="FLOAT" value={form.float} onChange={set("float")} suffix="USDC" />
			<SliderRow
				label="BUY SOL AT"
				value={Number.isFinite(buy) ? buy : around}
				min={around * 0.9}
				max={around}
				step={0.01}
				shown={Number.isFinite(buy) ? two(buy) : "-"}
				onChange={(value) => set("buyAt")(two(value))}
			/>
			<SliderRow
				label="SELL SOL AT"
				value={Number.isFinite(sell) ? sell : around}
				min={Number.isFinite(buy) ? buy : around}
				max={around * 1.1}
				step={0.01}
				shown={Number.isFinite(sell) ? two(sell) : "-"}
				onChange={(value) => set("sellAt")(two(value))}
			/>
			<SliderRow
				label="SPEND EACH BUY"
				value={numberFrom(form.perBuy) || 0}
				min={0}
				max={Number.isFinite(most) && most > 0 ? most : 0}
				step={0.01}
				shown={numberFrom(form.perBuy) > 0 ? `${two(numberFrom(form.perBuy))} USDC` : "-"}
				onChange={(value) => set("perBuy")(two(value))}
			/>

			<p className={`pt-2 ${LABEL}`}>
				{band.width > 0
					? band.covers
						? `A ${(band.width * 100).toFixed(2)}% BAND · KEEPS ABOUT ${(band.keeps * 100).toFixed(2)}% A ROUND TRIP`
						: `A ${(band.width * 100).toFixed(2)}% BAND · TOO NARROW: A ROUND TRIP COSTS ABOUT 0.6%`
					: "SET A FLOAT, THEN DRAG THE BAND"}
			</p>

			<div className="h-48 pt-2">
				<PriceChart
					interval="15m"
					history={120}
					levels={
						Number.isFinite(buy) && Number.isFinite(sell)
							? [
									{ price: sell, label: "SELL" },
									{ price: buy, label: "BUY" },
								]
							: []
					}
				/>
			</div>

			{error ? (
				<p role="alert" className="text-[11px] text-neutral-300">
					{error}
				</p>
			) : null}
			<button
				type="submit"
				disabled={!rangeReady(form) || creating}
				className="mt-2 h-10 border border-white/25 text-[11px] text-neutral-100 tracking-[0.14em] transition-colors hover:bg-white/[0.06] disabled:opacity-40"
			>
				{creating ? "MAKING ITS WALLET" : "CREATE MACHINE"}
			</button>
		</form>
	);
}

export function NewMachine({ onCreated }: { onCreated: (machineId: string) => void }) {
	const { api } = useRouter().options.context;
	const queryClient = useQueryClient();
	const create = useCreateMachine(api, queryClient);
	const price = useQuery({
		queryKey: ["sol-price"],
		queryFn: () => fetchPrice(),
		refetchInterval: 5_000,
	});
	const [form, setForm] = useState<RangeForm>({
		name: "",
		buyAt: "",
		sellAt: "",
		perBuy: "",
		float: "",
	});

	// The band starts from the price the first time one is known, and is the owner's to move after that.
	const usd = price.data?.usd;
	useEffect(() => {
		if (usd === undefined) return;
		setForm((was) => (was.buyAt || was.sellAt ? was : { ...was, ...startingBand(usd) }));
	}, [usd]);

	// Each buy follows the float: the most it can be with room left for the fee, until moved by hand.
	const change = (next: RangeForm) =>
		setForm(next.float !== form.float ? { ...next, perBuy: mostPerBuy(next.float) } : next);

	return (
		<NewMachineView
			form={form}
			price={usd}
			onChange={change}
			creating={create.isPending}
			error={create.error?.message}
			// Built only when pressed, never while typing: a half typed price is not a request.
			onCreate={() =>
				create.mutate(rangeRequest({ ...form, kind: range.kind }), {
					onSuccess: (made) => onCreated(made.machineId),
				})
			}
		/>
	);
}
