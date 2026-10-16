import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { assignSessions, dirKey, keyTitle, type KeySlot } from "../src/actions/assign";
import type { Session } from "../src/sessions/types";

function session(id: string, cwd: string, order: number, lastActivity = order): Session {
	const project = cwd.split(/[\\/]/).at(-1)!;
	return { id, cwd, project, state: "working", order, startedAt: order, lastActivity };
}
function key(id: string, column: number, project = "", row = 0, device = "d1"): KeySlot {
	return { id, device, row, column, project };
}
const ids = (m: Map<string, Session | undefined>) => Object.fromEntries([...m].map(([k, s]) => [k, s?.id]));

describe("attribution des touches", () => {
	test("dossiers comparés sans casse ni sens des séparateurs", () => {
		assert.equal(dirKey("C:\\Dev\\Projet\\"), dirKey("c:/dev/projet"));
	});

	test("automatique : ordre de démarrage, de gauche à droite puis de haut en bas", () => {
		const sessions = [session("a", "C:\\x\\a", 0), session("b", "C:\\x\\b", 1), session("c", "C:\\x\\c", 2)];
		const keys = [key("k3", 0, "", 1), key("k2", 1), key("k1", 0)];
		assert.deepEqual(ids(assignSessions(keys, sessions)), { k1: "a", k2: "b", k3: "c" });
	});

	test("une touche réservée prend son projet, les automatiques se partagent le reste", () => {
		const sessions = [session("a", "C:\\x\\a", 0), session("b", "C:\\x\\b", 1), session("c", "C:\\x\\c", 2)];
		const keys = [key("auto1", 0), key("auto2", 1), key("pinB", 2, "c:/X/B")];
		assert.deepEqual(ids(assignSessions(keys, sessions)), { pinB: "b", auto1: "a", auto2: "c" });
	});

	test("projet réservé sans session ouverte : la touche reste vide, le projet n'est pas pris par une automatique", () => {
		const sessions = [session("a", "C:\\x\\a", 0)];
		const keys = [key("pinB", 0, "C:\\x\\b"), key("auto", 1)];
		assert.deepEqual(ids(assignSessions(keys, sessions)), { pinB: undefined, auto: "a" });
	});

	test("plusieurs sessions dans le même dossier réservé : la plus récente", () => {
		const sessions = [session("old", "C:\\x\\a", 0, 50), session("new", "C:\\x\\a", 1, 90)];
		assert.deepEqual(ids(assignSessions([key("pin", 0, "C:\\x\\a"), key("auto", 1)], sessions)), { pin: "new", auto: undefined });
	});

	test("titres : ce qui manque est dit", () => {
		const ok = { serverError: false, anyHookReceived: true };
		assert.equal(keyTitle({ project: "" }, undefined, { ...ok, serverError: true }), "port\noccupé");
		assert.equal(keyTitle({ project: "" }, undefined, { ...ok, anyHookReceived: false }), "en attente\nde Claude");
		assert.equal(keyTitle({ project: "C:\\x\\mon-projet" }, undefined, ok), "mon-pro…\nfermée");
		assert.equal(keyTitle({ project: "" }, undefined, ok), "—");
		assert.equal(keyTitle({ project: "" }, session("a", "C:\\x\\demo", 0), ok), "demo\ntravaille");
	});
});
