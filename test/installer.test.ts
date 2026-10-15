import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, test } from "node:test";

import { DEFAULT_PORT, HOOK_EVENTS, HOOK_TIMEOUT_S, hookUrl } from "../src/config";
import { addHooks, installedHooks, removeHooks } from "../src/hooks/installer";

// Réglages existants de Florian : d'autres hooks, d'autres clés.
const EXISTING = {
	model: "opus",
	permissions: { allow: ["Bash(npm test)"] },
	hooks: {
		PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "echo pre" }] }],
		Stop: [
			{
				hooks: [
					{ type: "http", url: "http://localhost:9999/autre-outil" },
					{ type: "command", command: "notify-send fini" },
				],
			},
		],
	},
};

describe("installeur de hooks (fusion)", () => {
	test("ajoute un hook HTTP par événement sans toucher au reste", () => {
		const out = addHooks(EXISTING, 1234) as typeof EXISTING & { hooks: Record<string, unknown[]> };
		assert.equal(out.model, "opus");
		assert.deepEqual(out.permissions, EXISTING.permissions);
		for (const event of HOOK_EVENTS) {
			assert.deepEqual(out.hooks[event].at(-1), { hooks: [{ type: "http", url: hookUrl(1234, event), timeout: HOOK_TIMEOUT_S }] });
		}
		assert.deepEqual(out.hooks.PreToolUse[0], EXISTING.hooks.PreToolUse[0]);
		assert.deepEqual(out.hooks.Stop[0], EXISTING.hooks.Stop[0]);
		assert.equal(installedHooks(out).length, HOOK_EVENTS.length);
		// l'original n'est pas modifié
		assert.equal(EXISTING.hooks.PreToolUse.length, 1);
	});

	test("réinstaller ne duplique rien et change de port proprement", () => {
		const twice = addHooks(addHooks(EXISTING, 1234), 5678);
		const found = installedHooks(twice);
		assert.equal(found.length, HOOK_EVENTS.length);
		assert.ok(found.every((f) => f.port === 5678));
	});

	test("retrait : retour exact à l'état initial", () => {
		assert.deepEqual(removeHooks(addHooks(EXISTING, DEFAULT_PORT)), EXISTING);
		assert.deepEqual(removeHooks(addHooks({}, DEFAULT_PORT)), {});
		// Un « hooks: {} » vide disparaît (équivalent pour Claude Code).
		assert.deepEqual(removeHooks(addHooks({ hooks: {} }, DEFAULT_PORT)), {});
		assert.deepEqual(removeHooks({ hooks: {} }), { hooks: {} });
	});

	test("retrait : les hooks des autres outils en boucle locale sont conservés", () => {
		assert.deepEqual(removeHooks(EXISTING), EXISTING);
	});
});

describe("installeur de hooks (ligne de commande, bundle compilé)", () => {
	const CLI = path.resolve("com.zv-claude-streamdeck.sdPlugin/bin/hooks-cli.js");
	const run = (...args: string[]) => execFileSync(process.execPath, [CLI, ...args], { encoding: "utf8" });

	test("install / status / uninstall sur un settings.json existant, avec sauvegardes", () => {
		const dir = mkdtempSync(path.join(os.tmpdir(), "csd-"));
		const file = path.join(dir, "settings.json");
		const original = JSON.stringify(EXISTING, null, 2) + "\n";
		writeFileSync(file, original);

		run("install", "--settings", file, "--port", "4321");
		const installed = JSON.parse(readFileSync(file, "utf8"));
		assert.ok(installedHooks(installed).every((f) => f.port === 4321));
		assert.match(run("status", "--settings", file), /port 4321/);

		run("uninstall", "--settings", file);
		assert.equal(readFileSync(file, "utf8"), original);
		const backups = readdirSync(dir).filter((f) => f.startsWith("settings.json.bak-"));
		assert.ok(backups.length >= 1);
		assert.match(run("uninstall", "--settings", file), /rien à retirer/);
	});

	test("fichier absent : créé ; JSON illisible : abandon sans écrire", () => {
		const dir = mkdtempSync(path.join(os.tmpdir(), "csd-"));
		const fresh = path.join(dir, "sub", "settings.json");
		run("install", "--settings", fresh);
		assert.equal(installedHooks(JSON.parse(readFileSync(fresh, "utf8"))).length, HOOK_EVENTS.length);

		const broken = path.join(dir, "broken.json");
		writeFileSync(broken, "{ // commentaire\n}");
		assert.throws(() => run("install", "--settings", broken, "--port", "1"), /Command failed/);
		assert.equal(readFileSync(broken, "utf8"), "{ // commentaire\n}");
		assert.deepEqual(readdirSync(dir).filter((f) => f.includes("bak")), []);
	});
});
