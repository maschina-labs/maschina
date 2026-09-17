import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { crossmintEnv, MissingEnvError, setupEnv, turnkeyEnv } from "./env.ts";

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
