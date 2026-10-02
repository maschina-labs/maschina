import { describe, expect, it } from "vitest";
import { pagesIn, paperFrom } from "./papers.ts";

describe("a paper from its master file name", () => {
	it("reads the number, a readable title and the address it is served at", () => {
		expect(paperFrom("03-Protocol-and-Architecture.pdf")).toEqual({
			number: 3,
			title: "Protocol and Architecture",
			slug: "protocol-and-architecture",
			file: "03-Protocol-and-Architecture.pdf",
		});
	});

	it("evens out a title written in capitals, keeping small words small", () => {
		expect(paperFrom("13-BUILDING-ON-MASCHINA.pdf")?.title).toBe("Building on Maschina");
		expect(paperFrom("14-RISK-AND-DISCLOSURES.pdf")?.title).toBe("Risk and Disclosures");
		expect(paperFrom("08-The-Machine-Economy.pdf")?.title).toBe("The Machine Economy");
	});

	it("ignores anything that is not a numbered PDF", () => {
		expect(paperFrom("Figures")).toBeUndefined();
		expect(paperFrom(".DS_Store")).toBeUndefined();
		expect(paperFrom("notes.pdf")).toBeUndefined();
	});
});

describe("pages in a PDF", () => {
	it("counts page objects, not the page tree that holds them", () => {
		const pdf = Buffer.from("<< /Type /Pages /Count 2 >> << /Type /Page >> << /Type/Page >>");
		expect(pagesIn(pdf)).toBe(2);
	});
});
