import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { codeOf, DecisionLog } from "./decision-log.tsx";

describe("the decision log", () => {
	it("gives each kind of entry a short code, and still one for kinds it has not met", () => {
		expect(codeOf("trade.completed")).toBe("TRD_OK");
		expect(codeOf("authority.used")).toBe("AUTHORI");
	});

	it("lists decisions newest first, with the reason", () => {
		render(
			<DecisionLog
				record={[
					{ id: "1", type: "machine.started", occurredAt: "2026-09-28T05:22:33Z", payload: {} },
					{
						id: "2",
						type: "run.skipped",
						occurredAt: "2026-09-28T07:06:08Z",
						payload: { detail: "limit_reached: holds a position" },
					},
				]}
			/>,
		);

		const rows = screen.getAllByRole("listitem");
		expect(rows[0]).toHaveTextContent("RUN_NIL");
		expect(rows[0]).toHaveTextContent("// HOLDS A POSITION");
		expect(rows[1]).toHaveTextContent("MCH_RUN");
	});
});
