import { generateKeyPairSync } from "node:crypto";

export type ApiKeyPair = { publicKey: string; privateKey: string };

const hex = (base64url: string | undefined) => {
	if (!base64url) throw new Error("key export is missing a component");
	return Buffer.from(base64url, "base64url").toString("hex").padStart(64, "0");
};

/**
 * A P-256 key pair in the format Turnkey's API keys use: the private key as 32 bytes of hex, and the
 * public key as a 33 byte compressed point in hex.
 */
export function generateApiKeyPair(): ApiKeyPair {
	const { privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
	const jwk = privateKey.export({ format: "jwk" });
	const y = Buffer.from(hex(jwk.y), "hex");
	const prefix = (y.at(-1) ?? 0) % 2 === 0 ? "02" : "03";
	return { publicKey: `${prefix}${hex(jwk.x)}`, privateKey: hex(jwk.d) };
}
