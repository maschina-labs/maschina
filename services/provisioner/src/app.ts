import { CreateMachineRequest, CreateMachineResponse } from "@maschina/contracts";
import { MaschinaError } from "@maschina/core";
import {
	createServiceApp,
	type ReadinessCheck,
	registerHealth,
	requireServiceToken,
	type ServiceEnv,
} from "@maschina/service";
import type { ErrorReporter, Logger } from "@maschina/telemetry";
import { Hono } from "hono";
import type { MachineRequest } from "./create-machine.ts";

export type Provisioner = {
	create(request: MachineRequest): Promise<
		| {
				ok: true;
				value: {
					machineId: string;
					ownerId: string;
					walletAddress: string;
					definitionId: string;
					/** The provider's own id for the wallet. Ours to keep, never sent on. */
					providerWalletId: string;
				};
		  }
		| { ok: false; error: MaschinaError }
	>;
};

export type ProvisionerDeps = {
	version: string;
	/** The gateway presents this. Nothing else may ask for a machine to be created. */
	gatewayToken: string;
	logger: Logger;
	reporter?: ErrorReporter | undefined;
	checks: ReadinessCheck[];
	provisioner: Provisioner;
};

export const SERVICE = "provisioner";

function read(body: unknown): CreateMachineRequest {
	const parsed = CreateMachineRequest.safeParse(body);
	if (parsed.success) return parsed.data;
	const problems = parsed.error.issues.map(
		(issue) => `${issue.path.join(".") || "(body)"}: ${issue.message}`,
	);
	throw new MaschinaError("invalid_input", `the machine is not valid: ${problems.join(", ")}`, {
		details: { problems },
	});
}

export function buildApp(deps: ProvisionerDeps) {
	const app = createServiceApp({
		service: SERVICE,
		logger: deps.logger,
		maxBodyBytes: 64 * 1024,
		reporter: deps.reporter,
	});
	registerHealth(app, { service: SERVICE, version: deps.version, checks: deps.checks });

	// Creating a machine is administrative: only the gateway asks, and nothing here is public.
	app.use("/internal/*", requireServiceToken(deps.gatewayToken));
	app.route(
		"/internal/v1",
		new Hono<ServiceEnv>().post("/machines", async (c) => {
			const body = await c.req.json().catch(() => {
				throw new MaschinaError("invalid_input", "the machine is not JSON");
			});
			const asked = read(body);

			const made = await deps.provisioner.create({
				ownerWallet: asked.ownerWallet,
				name: asked.name,
				kind: asked.kind,
				settings: asked.settings,
				...(asked.rules ? { rules: asked.rules } : {}),
				limits: {
					budgetGranted: BigInt(asked.limits.budgetGranted),
					...(asked.limits.maxPerTrade === undefined
						? {}
						: { maxPerTrade: BigInt(asked.limits.maxPerTrade) }),
					...(asked.limits.maxPerDay === undefined
						? {}
						: { maxPerDay: BigInt(asked.limits.maxPerDay) }),
					approvedMints: asked.limits.approvedMints,
				},
			});
			if (!made.ok) throw made.error;

			// Only what the contract names: the provider's wallet id is an internal fact about a system
			// the caller has no business knowing, and the response shape is strict on purpose.
			const { machineId, ownerId, walletAddress, definitionId } = made.value;
			return c.json(
				CreateMachineResponse.parse({ machineId, ownerId, walletAddress, definitionId }),
				201,
			);
		}),
	);

	return app;
}
