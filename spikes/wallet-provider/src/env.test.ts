import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	checksEnv,
	crossmintEnv,
	crossmintMachineSigner,
	crossmintSignerSecret,
	heliusKey,
	MissingEnvError,
	setupEnv,
	turnkeyEnv,
} from "./env.ts";

const TURNKEY = {
	TURNKEY_API_PUBLIC_KEY: "02abc",
	TURNKEY_API_PRIVATE_KEY: "secret-private-key",
	TURNKEY_ORGANIZATION_ID: "0b1c8e5e-7c3b-4f55-9e57-6c2b4f0a9d11",
};

describe("turnkeyEnv", () => {
	it("reads the credentials and defaults the API address", () => {
		assert.deepEqual(turnkeyEnv(TURNKEY), {
			apiPublicKey: "02abc",
			apiPrivateKey: "secret-private-key",
			organizationId: TURNKEY.TURNKEY_ORGANIZATION_ID,
			apiBaseUrl: "https://api.turnkey.com",
		});
	});

	it("treats an empty optional value as unset, as a copied .env.example has", () => {
		assert.equal(
			turnkeyEnv({ ...TURNKEY, TURNKEY_API_BASE_URL: "" }).apiBaseUrl,
			"https://api.turnkey.com",
		);
	});

	it("names every missing or invalid variable without printing any value", () => {
		const source = {
			...TURNKEY,
			TURNKEY_API_PUBLIC_KEY: "",
			TURNKEY_ORGANIZATION_ID: "not-a-uuid",
		};
		assert.throws(
			() => turnkeyEnv(source),
			(error: unknown) => {
				assert.ok(error instanceof MissingEnvError);
				assert.deepEqual(error.variables, ["TURNKEY_API_PUBLIC_KEY", "TURNKEY_ORGANIZATION_ID"]);
				assert.ok(!error.message.includes("secret-private-key"));
				assert.ok(!error.message.includes("not-a-uuid"));
				return true;
			},
		);
	});
});

describe("crossmintEnv", () => {
	it("picks the API address from the kind of key", () => {
		assert.deepEqual(crossmintEnv({ CROSSMINT_SERVER_API_KEY: "sk_staging_abc" }), {
			apiKey: "sk_staging_abc",
			apiBaseUrl: "https://staging.crossmint.com",
		});
		assert.equal(
			crossmintEnv({ CROSSMINT_SERVER_API_KEY: "sk_production_abc" }).apiBaseUrl,
			"https://www.crossmint.com",
		);
	});

	it("refuses a missing key or a client key", () => {
		assert.throws(() => crossmintEnv({}), MissingEnvError);
		assert.throws(
			() => crossmintEnv({ CROSSMINT_SERVER_API_KEY: "ck_staging_abc" }),
			/CROSSMINT_SERVER_API_KEY/,
		);
	});
});

describe("setupEnv", () => {
	const OWNER = "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU";

	it("reads the owner's address and the signer's saved public key, if any", () => {
		assert.deepEqual(setupEnv({ SPIKE_OWNER_ADDRESS: OWNER }), {
			ownerAddress: OWNER,
			signerPublicKey: undefined,
		});
		const key = `03${"ab".repeat(32)}`;
		assert.equal(
			setupEnv({ SPIKE_OWNER_ADDRESS: OWNER, TURNKEY_SIGNER_API_PUBLIC_KEY: key }).signerPublicKey,
			key,
		);
	});

	it("refuses a missing or invalid owner address, or a malformed key", () => {
		assert.throws(() => setupEnv({}), /SPIKE_OWNER_ADDRESS/);
		assert.throws(() => setupEnv({ SPIKE_OWNER_ADDRESS: "not-an-address" }), /SPIKE_OWNER_ADDRESS/);
		assert.throws(
			() => setupEnv({ SPIKE_OWNER_ADDRESS: OWNER, TURNKEY_SIGNER_API_PUBLIC_KEY: "04zz" }),
			/TURNKEY_SIGNER_API_PUBLIC_KEY/,
		);
	});
});

describe("checksEnv", () => {
	const key = `02${"cd".repeat(32)}`;
	const complete = {
		TURNKEY_SIGNER_API_PUBLIC_KEY: key,
		TURNKEY_SIGNER_API_PRIVATE_KEY: "ef".repeat(32),
		HELIUS_API_KEY: "helius-key",
	};

	it("reads the signer's key pair and the RPC key", () => {
		assert.deepEqual(checksEnv(complete), {
			signerPublicKey: key,
			signerPrivateKey: "ef".repeat(32),
			heliusApiKey: "helius-key",
		});
	});

	it("names whatever is missing or malformed", () => {
		assert.throws(
			() => checksEnv({ ...complete, TURNKEY_SIGNER_API_PRIVATE_KEY: "short" }),
			/TURNKEY_SIGNER_API_PRIVATE_KEY/,
		);
		assert.throws(() => checksEnv({ ...complete, HELIUS_API_KEY: "" }), /HELIUS_API_KEY/);
		assert.throws(
			() => checksEnv({ ...complete, TURNKEY_SIGNER_API_PUBLIC_KEY: undefined }),
			/TURNKEY_SIGNER_API_PUBLIC_KEY/,
		);
	});
});

describe("crossmintSignerSecret", () => {
	it("reads a saved server secret, or nothing", () => {
		const secret = `xmsk1_${"0f".repeat(32)}`;
		assert.equal(crossmintSignerSecret({ CROSSMINT_SERVER_SIGNER_SECRET: secret }), secret);
		assert.equal(crossmintSignerSecret({}), undefined);
		assert.equal(crossmintSignerSecret({ CROSSMINT_SERVER_SIGNER_SECRET: "" }), undefined);
	});

	it("refuses a malformed secret without printing it", () => {
		assert.throws(
			() => crossmintSignerSecret({ CROSSMINT_SERVER_SIGNER_SECRET: "xmsk1_tooshort" }),
			(error: unknown) => error instanceof MissingEnvError && !error.message.includes("tooshort"),
		);
	});
});

describe("crossmintMachineSigner", () => {
	it("reads the machine signer's saved secret and works out its address", async () => {
		const { Keypair } = await import("@solana/web3.js");
		const keypair = Keypair.generate();
		const secretHex = Buffer.from(keypair.secretKey).toString("hex");
		assert.deepEqual(crossmintMachineSigner({ CROSSMINT_MACHINE_SIGNER_SECRET: secretHex }), {
			address: keypair.publicKey.toBase58(),
			secretHex,
		});
		assert.equal(crossmintMachineSigner({}), undefined);
	});

	it("refuses a malformed secret without printing it", () => {
		assert.throws(
			() => crossmintMachineSigner({ CROSSMINT_MACHINE_SIGNER_SECRET: "cd".repeat(10) }),
			(error: unknown) => error instanceof MissingEnvError && !error.message.includes("cdcd"),
		);
	});
});

describe("heliusKey", () => {
	it("reads the RPC key, and refuses a missing one", () => {
		assert.equal(heliusKey({ HELIUS_API_KEY: "k" }), "k");
		assert.throws(() => heliusKey({}), /HELIUS_API_KEY/);
	});
});
