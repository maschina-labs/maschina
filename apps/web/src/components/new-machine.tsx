import { range } from "@maschina/runtime";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { useCreateMachine } from "../lib/machines.ts";
import { bandOf, mostPerBuy, numberFrom, rangeReady, rangeRequest } from "../lib/range-form.ts";

export type RangeForm = {
	name: string;
	buyAt: string;
	sellAt: string;
	perBuy: string;
	float: string;
};

function Field({
	label,
	value,
	onChange,
}: {
	label: string;
	value: string;
	onChange: (value: string) => void;
}) {
	return (
		<label className="flex items-baseline justify-between gap-4 border-white/[0.06] border-b py-2 text-[12px]">
			<span className="shrink-0 text-neutral-500">{label}</span>
			<input
				value={value}
				onChange={(event) => onChange(event.target.value)}
				className="w-40 bg-transparent text-right text-neutral-100 tabular-nums outline-none placeholder:text-neutral-700"
			/>
		</label>
	);
}

/** Plain for now: exposed first, styled once everything is on the page. */
export function NewMachineView({
	form,
	onChange,
	onCreate,
	creating,
	error,
}: {
	form: RangeForm;
	onChange: (form: RangeForm) => void;
	onCreate: () => void;
	creating: boolean;
	error: string | undefined;
}) {
	const set = (key: keyof RangeForm) => (value: string) => onChange({ ...form, [key]: value });
	const band = bandOf(form.buyAt, form.sellAt);
	const tooBig =
		numberFrom(form.float) > 0 && numberFrom(form.perBuy) > Number(mostPerBuy(form.float));
	return (
		<form
			aria-label="New machine"
			onSubmit={(event) => {
				event.preventDefault();
				onCreate();
			}}
			className="flex flex-col"
		>
			<Field label="NAME" value={form.name} onChange={set("name")} />
			<Field label="BUY SOL AT" value={form.buyAt} onChange={set("buyAt")} />
			<Field label="SELL SOL AT" value={form.sellAt} onChange={set("sellAt")} />
			<Field label="SPEND EACH BUY" value={form.perBuy} onChange={set("perBuy")} />
			<Field label="FLOAT" value={form.float} onChange={set("float")} />
			{band.width > 0 ? (
				<p className="py-2 text-[11px] text-neutral-500">
					{(band.width * 100).toFixed(2)}% BAND ·{" "}
					{band.covers
						? `KEEPS ABOUT ${(band.keeps * 100).toFixed(2)}% A ROUND TRIP`
						: "TOO NARROW: A ROUND TRIP COSTS ABOUT 0.6%"}
				</p>
			) : null}
			{tooBig ? (
				<p className="py-2 text-[11px] text-neutral-500">
					AT MOST {mostPerBuy(form.float)} OF A {form.float} FLOAT
				</p>
			) : null}
			{error ? (
				<p role="alert" className="py-2 text-[11px] text-neutral-300">
					{error}
				</p>
			) : null}
			<button
				type="submit"
				disabled={!rangeReady(form) || creating}
				className="mt-3 self-start border border-white/15 px-3 py-1.5 text-[11px] text-neutral-200 hover:bg-white/[0.06] disabled:opacity-40"
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
	const [form, setForm] = useState<RangeForm>({
		name: "",
		buyAt: "",
		sellAt: "",
		perBuy: "",
		float: "",
	});
	return (
		<NewMachineView
			form={form}
			onChange={setForm}
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
