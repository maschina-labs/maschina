import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Secrets an owner gives us, like their own AI key, kept so that a copy of the database alone is useless.
 *
 * Each one is sealed with AES-256-GCM under a key that lives only in the server's environment, never in
 * the database. GCM also proves the sealed text was not changed: anything tampered with refuses to open
 * rather than opening to something else. A fresh random nonce per seal means the same secret never seals
 * to the same text twice, so nobody can tell two owners gave the same key.
 *
 * The version prefix leaves room to change how sealing works without guessing at old rows.
 */

export type SealingKey = { readonly bytes: Buffer };

export function parseSealingKey(base64: string): SealingKey {
	const bytes = Buffer.from(base64, "base64");
	if (bytes.length !== 32) throw new Error("a sealing key must be 32 bytes, written as base64");
	return { bytes };
}

export function sealSecret(key: SealingKey, secret: string): string {
	const iv = randomBytes(12);
	const cipher = createCipheriv("aes-256-gcm", key.bytes, iv);
	const body = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
	const tag = cipher.getAuthTag();
	return [
		"v1",
		iv.toString("base64url"),
		tag.toString("base64url"),
		body.toString("base64url"),
	].join(".");
}

export function openSecret(key: SealingKey, sealed: string): string {
	const [version, iv, tag, body, ...rest] = sealed.split(".");
	if (version !== "v1" || !iv || !tag || body === undefined || rest.length)
		throw new Error("not a sealed secret");
	const decipher = createDecipheriv("aes-256-gcm", key.bytes, Buffer.from(iv, "base64url"));
	decipher.setAuthTag(Buffer.from(tag, "base64url"));
	return Buffer.concat([
		decipher.update(Buffer.from(body, "base64url")),
		decipher.final(),
	]).toString("utf8");
}

/** What is shown for a stored secret: its last four characters, enough to recognize it and no more. */
export const hintFor = (secret: string) => (secret.length >= 8 ? secret.slice(-4) : "");
