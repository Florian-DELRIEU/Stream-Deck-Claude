import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { SessionManager } from "../src/sessions/session-manager";
import { ev } from "./helpers";

const tick = (ms = 20) => new Promise((r) => setTimeout(r, ms));

describe("gestionnaire de sessions", () => {
	test("sessions parallèles, ordre d'apparition, compteur « besoin de moi »", () => {
		const m = new SessionManager();
		m.handle(ev("SessionStart", {}, "a"));
		m.handle(ev("SessionStart", { cwd: "/x/autre" }, "b"));
		m.handle(ev("PreToolUse", { cwd: "/x/troisieme" }, "c")); // inconnue : créée à la volée
		assert.deepEqual(m.list().map((s) => s.id), ["a", "b", "c"]);
		assert.equal(m.get("c")!.state, "working");

		m.handle(ev("PermissionRequest", { tool_name: "Bash" }, "a"));
		m.handle(ev("Notification", { notification_type: "idle_prompt" }, "b"));
		assert.equal(m.needsYouCount(), 2);
		m.dispose();
	});

	test("fermeture : l'emplacement est libéré, les suivantes remontent", () => {
		const m = new SessionManager();
		for (const id of ["a", "b", "c"]) m.handle(ev("SessionStart", {}, id));
		m.handle(ev("SessionEnd", { reason: "other" }, "a"));
		assert.deepEqual(m.list().map((s) => s.id), ["b", "c"]);
		m.handle(ev("SessionStart", {}, "d"));
		assert.deepEqual(m.list().map((s) => s.id), ["b", "c", "d"]);
		m.dispose();
	});

	test("rafale d'événements : un seul `change` émis", async () => {
		const m = new SessionManager({ debounceMs: 10 });
		let changes = 0;
		m.on("change", () => changes++);
		m.handle(ev("UserPromptSubmit"));
		for (let i = 0; i < 50; i++) m.handle(ev("PreToolUse", { tool_name: "Read" }));
		await tick(40);
		assert.equal(changes, 1);
		m.dispose();
	});

	test("erreur d'outil : retour automatique à « travaille »", async () => {
		const m = new SessionManager({ debounceMs: 1 });
		m.handle(ev("UserPromptSubmit"));
		m.handle(ev("PostToolUseFailure", { tool_name: "Bash", error: "boom" }));
		assert.equal(m.get("s1")!.state, "error");
		// Repousse l'échéance dans le passé pour ne pas attendre 3 s.
		m.get("s1")!.error!.until = Date.now();
		m.handle(ev("Notification", { notification_type: "auth_success" })); // reprogramme le minuteur
		await tick(30);
		assert.equal(m.get("s1")!.state, "working");
		m.dispose();
	});

	test("sessions inactives oubliées", () => {
		let now = 0;
		const m = new SessionManager({ staleMs: 1000, now: () => now });
		m.handle(ev("SessionStart", {}, "vieille"));
		now = 900;
		m.handle(ev("SessionStart", {}, "recente"));
		now = 1500;
		m.pruneStale();
		assert.deepEqual(m.list().map((s) => s.id), ["recente"]);
		m.dispose();
	});
});
