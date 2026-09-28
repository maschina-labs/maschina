import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MarketStripView } from "./market-strip.tsx";

describe("the market strip", () => {
	it("shows the day's high, low and volume, and says it is live", () => {
		render(
			<MarketStripView
				day={{ last: 118.73, changePct: -2.1, high: 124.95, low: 118.14, volumeUsd: 356_201_337 }}
				live
			/>,
		);

		expect(screen.getByText("124.95")).toBeInTheDocument();
		expect(screen.getByText("118.14")).toBeInTheDocument();
		expect(screen.getByText("$356.2M")).toBeInTheDocument();
		expect(screen.getByText("LIVE")).toBeInTheDocument();
	});

	it("says when the stream is down", () => {
		render(<MarketStripView day={undefined} live={false} />);

		expect(screen.getByText("OFFLINE")).toBeInTheDocument();
	});
});
