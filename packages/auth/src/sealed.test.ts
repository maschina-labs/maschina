import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { hintFor, openSecret, parseSealingKey, sealSecret } from "./sealed.ts";

const key = parseSealingKey(randomBytes(32).toString("base64"));
const SECRET = "sk-ant-api03-not-a-real-key-0000000000000000wxyz";

describe("sealing an owner's secret", () => {
	it("opens to exactly what went in", () => {
		expect(openSecret(key, sealSecret(key, SECRET))).toBe(SECRET);
	});

	it("never carries the secret in the clear", () => {
		const sealed = sealSecret(key, SECRET);
		expect(sealed).not.toContain("sk-ant");
		expect(sealed.startsWith("v1.")).toBe(true);
	});

	it("seals the same secret differently every time", () => {
		expect(sealSecret(key, SECRET)).not.toBe(sealSecret(key, SECRET));
	});

	it("refuses to open under any other key", () => {
		const other = parseSealingKey(randomBytes(32).toString("base64"));
		expect(() => openSecret(other, sealSecret(key, SECRET))).toThrow();
	});

	it("refuses anything tampered with", () => {
		const [version, iv, tag, body = ""] = sealSecret(key, SECRET).split(".");
		const flipped = `${body.slice(0, -2)}${body.endsWith("AA") ? "BB" : "AA"}`;
		expect(() => openSecret(key, [version, iv, tag, flipped].join("."))).toThrow();
		expect(() => openSecret(key, "v2.a.b.c")).toThrow("not a sealed secret");
	});
});

describe("the sealing key", () => {
	it("must be 32 bytes", () => {
		expect(() => parseSealingKey(randomBytes(16).toString("base64"))).toThrow("32 bytes");
		expect(() => parseSealingKey("")).toThrow("32 bytes");
	});
});

describe("the hint shown for a stored secret", () => {
	it("shows only its last four characters", () => {
		expect(hintFor(SECRET)).toBe("wxyz");
		expect(hintFor("abc")).toBe("");
	});
});
