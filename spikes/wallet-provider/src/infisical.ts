import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

type Runner = (args: string[]) => Promise<void>;

const runInfisical: Runner = (args) =>
	new Promise((resolve, reject) => {
		const child = spawn("infisical", args, { stdio: ["ignore", "ignore", "pipe"] });
		let stderr = "";
		child.stderr.on("data", (chunk) => {
			stderr += chunk;
		});
		child.on("error", reject);
		child.on("close", (code) =>
			code === 0 ? resolve() : reject(new Error(`infisical exited with ${code}: ${stderr.trim()}`)),
		);
	});

/**
 * Saves secrets to Infisical. The values go through a file only this user can read, which is deleted
 * straight after, because command-line arguments are visible to other processes.
 */
export async function storeInInfisical(
	secrets: Record<string, string>,
	options: { env: string; path: string; run?: Runner },
): Promise<void> {
	for (const [name, value] of Object.entries(secrets)) {
		if (!/^[A-Z][A-Z0-9_]*$/.test(name))
			throw new Error(`invalid secret name ${JSON.stringify(name)}`);
		if (!value || /[\r\n]/.test(value)) throw new Error(`invalid value for ${name}`);
	}
	const dir = mkdtempSync(join(tmpdir(), "maschina-secrets-"));
	try {
		const file = join(dir, "secrets.env");
		const content = Object.entries(secrets)
			.map(([name, value]) => `${name}=${value}\n`)
			.join("");
		writeFileSync(file, content, { mode: 0o600 });
		await (options.run ?? runInfisical)([
			"secrets",
			"set",
			"--file",
			file,
			"--env",
			options.env,
			"--path",
			options.path,
			"--silent",
		]);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
}
