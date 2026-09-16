import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";

const root = new URL("../../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");
const services = readdirSync(new URL("services/", root), { withFileTypes: true })
	.filter((entry) => entry.isDirectory())
	.map((entry) => entry.name);
// Dependabot moves the image within a major version but can't edit .nvmrc, so only the major must match.
const nodeMajor = read(".nvmrc").trim().split(".")[0];

const baseImages = (service) =>
	read(`services/${service}/Dockerfile`)
		.split("\n")
		.filter((line) => /^FROM\s/i.test(line))
		.map((line) => line.split(/\s+/)[1]);

describe("service Dockerfiles", () => {
	it("exist for every service", () => {
		assert.ok(services.length > 0);
		for (const service of services) assert.ok(baseImages(service).length > 0, service);
	});

	it("pin every base image by digest, keeping the tag readable", () => {
		for (const service of services) {
			for (const image of baseImages(service)) {
				assert.match(image, /^[a-z0-9./-]+:[\w.-]+@sha256:[0-9a-f]{64}$/, `${service}: ${image}`);
			}
		}
	});

	it("use the Node major version the repository runs on, and the same image everywhere", () => {
		const images = new Set(services.flatMap(baseImages));
		assert.equal(images.size, 1, [...images].join(", "));
		const [image] = images;
		assert.match(image, new RegExp(`^node:${nodeMajor}\\.\\d+\\.\\d+-alpine@`), image);
	});
});
