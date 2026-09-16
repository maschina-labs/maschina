import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { crossmintEnv, MissingEnvError, turnkeyEnv } from "./env.ts";

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
