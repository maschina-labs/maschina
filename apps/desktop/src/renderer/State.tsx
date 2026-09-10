/**
 * Stating an objective. `ENVIRONMENT_PLAN` slice 7.
 *
 * **This is not a chat box.** `08-ENVIRONMENT` §1: a chat box makes the human the
 * scheduler again, because work only advances while they are typing. Stating an
 * objective is one action that hands work over, not a conversation to maintain.
 *
 * The contract is the point of the form, not an afterthought. `09-EVALUATION` §2
 * refuses an objective with no agreement about what done means, and invariant 16
 * freezes the contract at admission, so this is the last moment anybody can
 * change it. The form says so.
 *
 * The model can draft the criteria. It cannot accept them: what comes back is
 * editable text, and admitting on somebody's behalf would make the frozen hash a
 * promise nobody made.
 */

import { useCallback, useState } from "react";
import { useReading } from "./useLog.ts";

const ORIGIN = "human:operator";

interface Criterion {
	/** Stable across edits and insertions, so React keeps each row's own input. */
	key: string;
	id: string;
	criterion: string;
	verifyBy: string;
	strength: string;
	evidence: string;
}

const blank = (): Criterion => ({
	key: crypto.randomUUID(),
	id: "",
	criterion: "",
	verifyBy: "",
	strength: "mechanical",
	evidence: "",
});

export function State({ onStated }: { readonly onStated: (id: string) => void }) {
	const [statement, setStatement] = useState("");
	const [criteria, setCriteria] = useState<Criterion[]>([blank()]);
	const [problems, setProblems] = useState<readonly string[]>([]);
	const [busy, setBusy] = useState(false);
	const [drafted, setDrafted] = useState<string | null>(null);

	const readDrafters = useCallback(async () => {
		const bridge = window.maschina;
		if (bridge === undefined) return { ok: false as const, problem: "No bridge." };
		return bridge.objectives.drafters();
	}, []);
	const { value: drafters } = useReading(readDrafters, 60_000);

	const set = (index: number, field: keyof Criterion, value: string) =>
		setCriteria((was) => was.map((c, i) => (i === index ? { ...c, [field]: value } : c)));

	const contract = () => ({
		criteria: criteria
			.filter((c) => c.id.trim() !== "" || c.criterion.trim() !== "")
			.map((c) => ({
				id: c.id.trim(),
				criterion: c.criterion.trim(),
				verifyBy: c.verifyBy.trim(),
				strength: c.strength,
				evidence: c.evidence
					.split(",")
					.map((e) => e.trim())
					.filter((e) => e !== ""),
			})),
		nonGoals: [],
		failureConditions: [],
	});

	const admit = async () => {
		if (busy) return;
		setBusy(true);
		setProblems([]);
		const bridge = window.maschina;
		if (bridge === undefined) {
			setProblems(["The bridge did not load, so nothing can be stated."]);
			setBusy(false);
			return;
		}
		const result = await bridge.objectives.state({
			statement: statement.trim(),
			contract: contract(),
			origin: ORIGIN,
		});
		if (result.ok && result.value.problems.length === 0) {
			setStatement("");
			setCriteria([blank()]);
			setDrafted(null);
			onStated(result.value.objective.id);
		} else if (result.ok) {
			// Refused, and the reasons are the answer. Nothing is cleared: the
			// person is meant to fix it, not retype it.
			setProblems(result.value.problems);
		} else {
			setProblems([result.problem]);
		}
		setBusy(false);
	};

	const askForADraft = async () => {
		const capability = (drafters ?? [])[0];
		if (capability === undefined || busy) return;
		setBusy(true);
		setProblems([]);
		const bridge = window.maschina;
		const result = await bridge?.objectives.draft({
			statement: statement.trim(),
			capabilityId: capability.id,
		});
		if (result?.ok) {
			setDrafted(result.value.text);
			applyDraft(result.value.text, setCriteria, setProblems);
		} else {
			setProblems([result?.problem ?? "The draft did not arrive."]);
		}
		setBusy(false);
	};

	const canDraft = (drafters ?? []).length > 0 && statement.trim() !== "";

	return (
		<div className="stating">
			<h2 className="detail__statement">State an objective</h2>

			<label className="field">
				<span className="field__label">What you want done</span>
				<textarea
					className="answer__box"
					rows={2}
					value={statement}
					placeholder="Add a README to the sandbox repository"
					onChange={(e) => setStatement(e.target.value)}
				/>
			</label>

			<h3 className="detail__heading">
				What has to be true for it to count as done
				<span className="detail__count">frozen once stated</span>
			</h3>

			{criteria.map((criterion, index) => (
				<div key={criterion.key} className="criterion">
					<div className="field__row">
						<input
							className="field__input field__input--short"
							value={criterion.id}
							placeholder="id"
							onChange={(e) => set(index, "id", e.target.value)}
						/>
						<select
							className="field__input field__input--short"
							value={criterion.strength}
							onChange={(e) => set(index, "strength", e.target.value)}
						>
							<option value="mechanical">mechanical</option>
							<option value="independent">independent</option>
							<option value="judgement">judgement</option>
						</select>
					</div>
					<input
						className="field__input"
						value={criterion.criterion}
						placeholder="the condition, in one sentence"
						onChange={(e) => set(index, "criterion", e.target.value)}
					/>
					<input
						className="field__input"
						value={criterion.verifyBy}
						placeholder="how it is checked"
						onChange={(e) => set(index, "verifyBy", e.target.value)}
					/>
					<input
						className="field__input"
						value={criterion.evidence}
						placeholder="what makes it checkable, comma separated"
						onChange={(e) => set(index, "evidence", e.target.value)}
					/>
				</div>
			))}

			<button
				type="button"
				className="answer__refuse"
				onClick={() => setCriteria((was) => [...was, blank()])}
			>
				another criterion
			</button>

			{problems.length > 0 && (
				<ul className="problems">
					{problems.map((problem) => (
						<li key={problem}>{problem}</li>
					))}
				</ul>
			)}

			{drafted !== null && (
				<p className="criterion__how">
					<span className="dim">drafted by the model, and yours to change.</span> Nothing is
					agreed until you state it.
				</p>
			)}

			<div className="answer__foot">
				{canDraft ? (
					<button
						type="button"
						className="answer__refuse"
						disabled={busy}
						onClick={() => void askForADraft()}
					>
						draft the criteria
					</button>
				) : (
					<span className="dim">
						{(drafters ?? []).length === 0
							? "no model capability granted, so nothing can draft"
							: "write what you want done first"}
					</span>
				)}
				<button
					type="button"
					className="answer__send"
					disabled={busy || statement.trim() === ""}
					onClick={() => void admit()}
				>
					{busy ? "working" : "state it"}
				</button>
			</div>
		</div>
	);
}

/**
 * Turn a drafted contract into fields.
 *
 * The model was asked for JSON and usually gives it. When it does not, the raw
 * text is kept and shown rather than discarded, because a person can read a bad
 * draft and a person cannot read a swallowed one.
 */
function applyDraft(
	text: string,
	setCriteria: (c: Criterion[]) => void,
	setProblems: (p: string[]) => void,
): void {
	const json = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
	try {
		const parsed = JSON.parse(json) as {
			criteria?: {
				id?: string;
				criterion?: string;
				verifyBy?: string;
				strength?: string;
				evidence?: string[];
			}[];
		};
		const criteria = (parsed.criteria ?? []).map((c) => ({
			key: crypto.randomUUID(),
			id: c.id ?? "",
			criterion: c.criterion ?? "",
			verifyBy: c.verifyBy ?? "",
			strength: c.strength ?? "mechanical",
			evidence: (c.evidence ?? []).join(", "),
		}));
		if (criteria.length === 0) {
			setProblems(["The draft had no criteria in it. Write them, or ask again."]);
			return;
		}
		setCriteria(criteria);
	} catch {
		setProblems(["The draft was not readable as a contract. It is shown above unchanged."]);
	}
}
