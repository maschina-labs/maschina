/**
 * A daemon's identity: a stable id and an Ed25519 key pair, created on first start and kept on disk
 * with owner-only permissions. The public key is how the orchestrator will recognise this node; the
 * private key never leaves the machine.
 */

import { generateKeyPairSync } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { MaschinaError, type NodeId, newId, parseId } from "@maschina/core";
import { z } from "zod";

const StoredIdentity = z.object({
	version: z.literal(1),
	nodeId: z.string(),
	publicKey: z.string().startsWith("-----BEGIN PUBLIC KEY-----"),
	privateKey: z.string().startsWith("-----BEGIN PRIVATE KEY-----"),
	createdAt: z.iso.datetime(),
});

export type NodeIdentity = {
	nodeId: NodeId;
	publicKey: string;
	privateKey: string;
	createdAt: string;
};

const OWNER_ONLY = 0o600;

export function loadOrCreateIdentity(
	path: string,
	now: () => Date = () => new Date(),
): NodeIdentity {
	if (existsSync(path)) return load(path);

	const { publicKey, privateKey } = generateKeyPairSync("ed25519", {
		publicKeyEncoding: { type: "spki", format: "pem" },
		privateKeyEncoding: { type: "pkcs8", format: "pem" },
	});
	const identity: NodeIdentity = {
		nodeId: newId<"node">(),
		publicKey,
		privateKey,
		createdAt: now().toISOString(),
	};

	mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
	writeFileSync(path, `${JSON.stringify({ version: 1, ...identity }, null, "\t")}\n`, {
		mode: OWNER_ONLY,
		flag: "wx",
	});
	return identity;
}

function load(path: string): NodeIdentity {
	const mode = statSync(path).mode & 0o777;
	if (mode & 0o077) {
		throw new MaschinaError(
			"forbidden",
			`${path} is readable by other users. Fix with: chmod 600 ${path}`,
		);
	}
	const parsed = StoredIdentity.safeParse(JSON.parse(readFileSync(path, "utf8")));
	if (!parsed.success) {
		throw new MaschinaError("invalid_input", `${path} is not a valid daemon identity`);
	}
	const { nodeId, publicKey, privateKey, createdAt } = parsed.data;
	return { nodeId: parseId(nodeId, "node"), publicKey, privateKey, createdAt };
}
