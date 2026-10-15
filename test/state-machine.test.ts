import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { TOOL_ERROR_MS, applyEvent, createSession, expireError, projectName } from "../src/sessions/state-machine";
import type { HookEvent, Session } from "../src/sessions/types";
import { ev } from "./helpers";

function run(events: HookEvent[], t0 = 1000): Session[] {
	let s = createSession(events[0], 0, t0);
	return events.map((e, i) => (s = applyEvent(s, e, t0 + i)));
}
const states = (list: Session[]) => list.map((s) => s.state);

describe("machine à états", () => {
	test("nom de projet tiré du dossier (Windows et POSIX)", () => {
		assert.equal(projectName("C:\\Users\\flo\\projets\\mon-projet"), "mon-projet");
		assert.equal(projectName("/home/flo/demo/"), "demo");
		assert.equal(projectName(undefined), "?");
	});

	test("session inconnue : créée au repos", () => {
		const s = createSession(ev("PreToolUse"), 3, 50);
		assert.equal(s.state, "idle");
		assert.equal(s.project, "mon-projet");
		assert.equal(s.order, 3);
	});

	test("cycle complet : repos → travaille → permission → travaille → terminée → fermée", () => {
		const list = run([
			ev("SessionStart", { source: "startup", model: "claude-x" }),
			ev("UserPromptSubmit", { prompt: "go" }),
			ev("PreToolUse", { tool_name: "Edit", tool_input: { file_path: "C:\\p\\a.ts" } }),
			ev("PermissionRequest", { tool_name: "Edit" }),
			ev("PostToolUse", { tool_name: "Edit" }),
			ev("Stop"),
			ev("SessionEnd", { reason: "prompt_input_exit" }),
		]);
		assert.deepEqual(states(list), ["idle", "working", "working", "waiting-permission", "working", "done", "closed"]);
		assert.equal(list[0].model, "claude-x");
		assert.equal(list[2].currentTool, "Edit");
		assert.equal(list[2].currentFile, "C:\\p\\a.ts");
		assert.equal(list[3].pendingTool, "Edit");
		assert.equal(list[4].pendingTool, undefined);
		assert.equal(list[5].taskStartedAt, 1001);
		assert.equal(list[5].taskEndedAt, 1005);
	});

	test("notification permission_prompt → attend une permission", () => {
		const list = run([ev("UserPromptSubmit"), ev("Notification", { notification_type: "permission_prompt" })]);
		assert.equal(list[1].state, "waiting-permission");
	});

	test("notifications d'attente → attend ta réponse, puis nouveau prompt → travaille", () => {
		for (const type of ["idle_prompt", "agent_needs_input", "elicitation_dialog"]) {
			const list = run([ev("Stop"), ev("Notification", { notification_type: type }), ev("UserPromptSubmit")]);
			assert.deepEqual(states(list), ["done", "waiting-input", "working"], type);
		}
	});

	test("autres notifications : pas de changement d'état", () => {
		const list = run([ev("UserPromptSubmit"), ev("Notification", { notification_type: "auth_success" })]);
		assert.equal(list[1].state, "working");
	});

	test("un outil lancé en parallèle ne fait pas oublier la permission en attente", () => {
		const list = run([ev("UserPromptSubmit"), ev("PermissionRequest", { tool_name: "Bash" }), ev("PreToolUse", { tool_name: "Read" })]);
		assert.equal(list[2].state, "waiting-permission");
		assert.equal(list[2].pendingTool, "Bash");
	});

	test("échec d'outil : erreur brève puis retour à travaille", () => {
		const list = run([ev("UserPromptSubmit"), ev("PostToolUseFailure", { tool_name: "Bash", error: "Exit code 1" })]);
		const s = list[1];
		assert.equal(s.state, "error");
		assert.deepEqual(s.error, { kind: "tool", type: "Bash", until: 1001 + TOOL_ERROR_MS });
		assert.equal(expireError(s, 1001 + TOOL_ERROR_MS - 1), s);
		const back = expireError(s, 1001 + TOOL_ERROR_MS);
		assert.equal(back.state, "working");
		assert.equal(back.error, undefined);
	});

	test("interruption (Échap) : la session rend la main", () => {
		const list = run([ev("UserPromptSubmit"), ev("PostToolUseFailure", { tool_name: "Bash", is_interrupt: true })]);
		assert.equal(list[1].state, "done");
	});

	test("échec d'API : erreur durable avec le type, effacée par un nouveau prompt", () => {
		const list = run([ev("UserPromptSubmit"), ev("StopFailure", { error: "rate_limit" }), ev("UserPromptSubmit")]);
		assert.equal(list[1].state, "error");
		assert.deepEqual(list[1].error, { kind: "api", type: "rate_limit" });
		assert.equal(expireError(list[1], 10 ** 12), list[1]);
		assert.equal(list[2].state, "working");
		assert.equal(list[2].error, undefined);
	});

	test("Stop d'un sous-agent : la session continue de travailler", () => {
		const list = run([ev("UserPromptSubmit"), ev("SubagentStart", { agent_id: "a1" }), ev("Stop", { agent_id: "a1" })]);
		assert.deepEqual(states(list), ["working", "working", "working"]);
	});

	test("compactage : l'état ne change pas ; /clear : retour au repos", () => {
		const list = run([ev("UserPromptSubmit"), ev("SessionStart", { source: "compact" }), ev("SessionStart", { source: "clear" })]);
		assert.deepEqual(states(list), ["working", "working", "idle"]);
	});

	test("élicitation MCP : attend ta réponse puis reprend", () => {
		const list = run([ev("UserPromptSubmit"), ev("Elicitation"), ev("ElicitationResult")]);
		assert.deepEqual(states(list), ["working", "waiting-input", "working"]);
	});

	test("modèle, effort et mode de permission suivis", () => {
		const list = run([
			ev("UserPromptSubmit", { permission_mode: "plan" }),
			ev("PreToolUse", { tool_name: "Read", effort: { level: "high" } }),
			ev("PostModelSwitch", { to_model: "claude-y" }),
		]);
		assert.equal(list[2].permissionMode, "plan");
		assert.equal(list[2].effort, "high");
		assert.equal(list[2].model, "claude-y");
	});
});
