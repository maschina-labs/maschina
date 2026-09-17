import assert from "node:assert/strict";
import { createPrivateKey, createPublicKey, ECDH, sign, verify } from "node:crypto";
import { describe, it } from "node:test";
import { generateApiKeyPair } from "./api-key.ts";

const fromHex = (hex: string) => Buffer.from(hex, "hex").toString("base64url");

describe("generateApiKeyPair", () => {
	it("returns a 32 byte private key and a 33 byte compressed public key, in hex", () => {
		const { publicKey, privateKey } = generateApiKeyPair();
		assert.match(privateKey, /^[0-9a-f]{64}$/);
		assert.match(publicKey, /^0[23][0-9a-f]{64}$/);
	});

	it("produces a public key that verifies signatures from the private key", () => {
		const { publicKey, privateKey } = generateApiKeyPair();
		const uncompressed = Buffer.from(
			ECDH.convertKey(publicKey, "prime256v1", "hex", "hex", "uncompressed") as string,
			"hex",
		);
		const x = uncompressed.subarray(1, 33).toString("hex");
		const y = uncompressed.subarray(33, 65).toString("hex");

		const signer = createPrivateKey({
			key: { kty: "EC", crv: "P-256", d: fromHex(privateKey), x: fromHex(x), y: fromHex(y) },
			format: "jwk",
		});
		const checker = createPublicKey({
			key: { kty: "EC", crv: "P-256", x: fromHex(x), y: fromHex(y) },
			format: "jwk",
		});
		const message = Buffer.from("maschina");
		assert.ok(verify("sha256", message, checker, sign("sha256", message, signer)));
	});

	it("never repeats a key", () => {
		const keys = new Set(Array.from({ length: 20 }, () => generateApiKeyPair().privateKey));
		assert.equal(keys.size, 20);
	});
});
