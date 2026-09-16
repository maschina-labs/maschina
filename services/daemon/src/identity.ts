/**
 * A daemon's identity: a stable id and an Ed25519 key pair, created on first start and kept on disk
 * with owner-only permissions. The public key is how the orchestrator will recognise this node; the
 * private key never leaves the machine.
 */

import { generateKeyPairSync } from "node:crypto";
import {
	closeSync,
	constants,
	fstatSync,
	mkdirSync,
	openSync,
	readFileSync,
	writeFileSync,
} from "node:fs";
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
	const existing = load(path);
	if (existing) return existing;

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
	try {
		writeFileSync(path, `${JSON.stringify({ version: 1, ...identity }, null, "\t")}\n`, {
			mode: OWNER_ONLY,
			flag: "wx",
		});
	} catch (error) {
		// Another daemon created it first. Use that one, so both agree on who this node is.
		if (hasCode(error, "EEXIST")) {
			const winner = load(path);
			if (winner) return winner;
		}
		throw error;
	}
	return identity;
}

/**
 * Opens the file once, without following links, and checks and reads that same open file. Checking by
 * path and then reading by path would let the file be swapped in between.
 */
function load(path: string): NodeIdentity | undefined {
	let fd: number;
	try {
		fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
	} catch (error) {
		if (hasCode(error, "ENOENT")) return undefined;
		if (hasCode(error, "ELOOP")) {
			throw new MaschinaError("forbidden", `${path} is a symbolic link. Use the file itself.`);
		}
		throw error;
	}
	try {
		const stat = fstatSync(fd);
		if (!stat.isFile()) {
			throw new MaschinaError("forbidden", `${path} is not a regular file`);
		}
		if (process.getuid && stat.uid !== process.getuid()) {
			throw new MaschinaError("forbidden", `${path} belongs to another user`);
		}
		if (stat.mode & 0o077) {
			throw new MaschinaError(
				"forbidden",
				`${path} is readable by other users. Fix with: chmod 600 ${path}`,
			);
		}
		const parsed = StoredIdentity.safeParse(parseJson(readFileSync(fd, "utf8")));
		if (!parsed.success) {
			throw new MaschinaError("invalid_input", `${path} is not a valid daemon identity`);
		}
		const { nodeId, publicKey, privateKey, createdAt } = parsed.data;
		return { nodeId: parseId(nodeId, "node"), publicKey, privateKey, createdAt };
	} finally {
		closeSync(fd);
	}
}

function parseJson(text: string): unknown {
	try {
		return JSON.parse(text);
	} catch {
		return undefined;
	}
}

function hasCode(error: unknown, code: string): boolean {
	return error instanceof Error && "code" in error && error.code === code;
}
