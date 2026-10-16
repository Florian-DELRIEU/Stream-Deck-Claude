import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";

import { ROUTE_PREFIX } from "../src/config";
import { HookServer, validateHook } from "../src/server/hook-server";
import type { HookEvent } from "../src/sessions/types";

const silent = { debug() {}, info() {}, warn() {}, error() {} };

describe("serveur de hooks", () => {
	const received: HookEvent[] = [];
	let onEvent: (e: HookEvent) => void = (e) => received.push(e);
	const server = new HookServer({ port: 0, logger: silent, onEvent: (e) => onEvent(e) });
	let base = "";

	before(async () => {
		const port = await server.listen();
		base = `http://127.0.0.1:${port}${ROUTE_PREFIX}`;
		// Premier fetch du processus = chargement d'undici : hors de la mesure de temps.
		await fetch(base + "health");
	});
	after(() => server.close());

	const post = (route: string, body: unknown, headers: Record<string, string> = {}) =>
		fetch(base + route, {
			method: "POST",
			headers: { "Content-Type": "application/json", ...headers },
			body: typeof body === "string" ? body : JSON.stringify(body),
		});

	test("POST valide : 200 corps vide, événement transmis", async () => {
		const t0 = performance.now();
		const res = await post("PreToolUse", { hook_event_name: "PreToolUse", session_id: "abc", tool_name: "Bash" });
		const elapsed = performance.now() - t0;
		assert.equal(res.status, 200);
		assert.equal(await res.text(), "");
		assert.ok(elapsed < 200, `réponse en ${elapsed} ms`);
		await new Promise((r) => setTimeout(r, 10));
		assert.equal(received.at(-1)?.tool_name, "Bash");
	});

	test("la réponse part avant le traitement, même si celui-ci est lent ou plante", async () => {
		onEvent = () => {
			const end = Date.now() + 300;
			while (Date.now() < end); // traitement bloquant volontaire
			throw new Error("plantage simulé");
		};
		const res = await post("Stop", { hook_event_name: "Stop", session_id: "abc" });
		assert.equal(res.status, 200);
		await new Promise((r) => setTimeout(r, 350));
		onEvent = (e) => received.push(e);
		// Le serveur répond toujours après le plantage.
		assert.equal((await post("Stop", { hook_event_name: "Stop", session_id: "abc" })).status, 200);
	});

	test("JSON invalide, champ manquant, route incohérente : 400", async () => {
		assert.equal((await post("Stop", "{pas du json")).status, 400);
		assert.equal((await post("Stop", { hook_event_name: "Stop" })).status, 400);
		assert.equal((await post("Stop", [1, 2])).status, 400);
		assert.equal((await post("Stop", { hook_event_name: "PreToolUse", session_id: "x" })).status, 400);
	});

	test("route inconnue : 404 ; mauvaise méthode : 405 ; santé : 200", async () => {
		assert.equal((await post("Inexistant", {})).status, 404);
		assert.equal((await fetch(base + "Stop")).status, 405);
		assert.equal((await fetch(base + "health")).status, 200);
		assert.equal((await fetch(base.replace(ROUTE_PREFIX, "/autre"))).status, 404);
	});

	test("corps trop gros : 413", async () => {
		const res = await post("Stop", "x".repeat(1024 * 1024 + 10)).catch(() => undefined);
		assert.ok(res === undefined || res.status === 413);
	});

	test("hôte étranger (DNS rebinding) : 403", async () => {
		const http = await import("node:http");
		const status = await new Promise<number>((resolve, reject) => {
			const req = http.request(base + "Stop", { method: "POST", headers: { Host: "evil.example:80" } }, (res) => {
				res.resume();
				resolve(res.statusCode!);
			});
			req.on("error", reject);
			req.end("{}");
		});
		assert.equal(status, 403);
	});

	test("validateHook garde les champs inconnus", () => {
		const r = validateHook("Notification", JSON.stringify({ hook_event_name: "Notification", session_id: "s", futur: 1 }));
		assert.ok(r.ok && (r.event as unknown as { futur: number }).futur === 1);
	});
});
