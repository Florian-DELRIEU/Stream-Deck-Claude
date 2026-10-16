// Test de bout en bout : lance le plugin compilé (bin/plugin.js) face à un faux logiciel
// Stream Deck (WebSocket), envoie de vrais POST de hooks comme Claude Code, et pilote
// l'inspecteur (liste des sessions, installation des hooks dans un settings.json temporaire).
// Prérequis : npm run build.
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { WebSocketServer } from "ws";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PLUGIN_DIR = path.join(ROOT, "com.zv-claude-streamdeck.sdPlugin");
const SESSION = "com.zv-claude-streamdeck.session";
const HOOK_PORT = 47000 + (process.pid % 1000);
const BASE = `http://127.0.0.1:${HOOK_PORT}/claude-streamdeck/`;
const CONFIG_DIR = mkdtempSync(path.join(os.tmpdir(), "csd-config-"));
const SETTINGS = path.join(CONFIG_DIR, "settings.json");

async function waitFor(fn, label, timeout = 5000) {
	const start = Date.now();
	for (;;) {
		const result = await fn();
		if (result) return result;
		if (Date.now() - start > timeout) throw new Error(`Délai dépassé : ${label}`);
		await new Promise((r) => setTimeout(r, 20));
	}
}

class FakeStreamDeck {
	received = [];
	start() {
		this.wss = new WebSocketServer({ port: 0, host: "127.0.0.1" });
		this.wss.on("connection", (ws) => {
			this.ws = ws;
			ws.on("message", (raw) => this.received.push(JSON.parse(String(raw))));
		});
		return new Promise((resolve) => this.wss.on("listening", resolve));
	}
	get port() {
		return this.wss.address().port;
	}
	send(msg) {
		this.ws.send(JSON.stringify(msg));
	}
	last(event, context) {
		return this.received.filter((m) => m.event === event && (!context || m.context === context)).at(-1);
	}
	title(context) {
		return this.last("setTitle", context)?.payload.title;
	}
	/** Dernier message `event` envoyé à l'inspecteur (sendToPropertyInspector). */
	toInspector(event) {
		return this.received.filter((m) => m.event === "sendToPropertyInspector" && m.payload?.event === event).at(-1)?.payload;
	}
	payload(column, settings) {
		return { settings, coordinates: { column, row: 0 }, controller: "Keypad", state: 0, isInMultiAction: false };
	}
	appear(context, column, settings = {}) {
		this.send({ event: "willAppear", action: SESSION, context, device: "dev1", payload: this.payload(column, settings) });
	}
	settings(context, column, settings) {
		this.send({ event: "didReceiveSettings", action: SESSION, context, device: "dev1", payload: this.payload(column, settings) });
	}
	openInspector(context) {
		this.send({ event: "propertyInspectorDidAppear", action: SESSION, context, device: "dev1" });
	}
	toPlugin(context, payload) {
		this.send({ event: "sendToPlugin", action: SESSION, context, payload });
	}
	stop() {
		return new Promise((resolve) => this.wss.close(resolve));
	}
}

const hook = (event, session_id, cwd, extra = {}) =>
	fetch(BASE + event, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ hook_event_name: event, session_id, cwd, ...extra }),
	});

describe("plugin Claude Deck (bout en bout)", () => {
	const sd = new FakeStreamDeck();
	let child;
	let stderr = "";

	before(async () => {
		writeFileSync(SETTINGS, JSON.stringify({ model: "opus" }, null, 2) + "\n");
		await sd.start();
		const info = {
			application: { font: "", language: "fr", platform: "windows", platformVersion: "10", version: "7.1.0.0" },
			plugin: { uuid: "com.zv-claude-streamdeck", version: "0.1.0.0" },
			devicePixelRatio: 1,
			colors: {},
			devices: [{ id: "dev1", name: "Stream Deck MK.2", size: { columns: 5, rows: 3 }, type: 0 }],
		};
		child = spawn(
			process.execPath,
			["bin/plugin.js", "-port", String(sd.port), "-pluginUUID", "p1", "-registerEvent", "registerPlugin", "-info", JSON.stringify(info)],
			{ cwd: PLUGIN_DIR, env: { ...process.env, CLAUDE_STREAMDECK_PORT: String(HOOK_PORT), CLAUDE_CONFIG_DIR: CONFIG_DIR } },
		);
		child.stderr.on("data", (d) => (stderr += d));
		await waitFor(() => sd.last("registerPlugin"), "enregistrement du plugin");
		await waitFor(() => fetch(BASE + "health").then((r) => r.ok, () => false), "serveur de hooks");
	});

	after(async () => {
		child?.kill();
		await sd.stop();
		if (stderr.trim()) console.log("stderr du plugin :\n" + stderr);
	});

	test("avant tout hook : la touche dit qu'elle attend Claude", async () => {
		sd.appear("k1", 0);
		await waitFor(() => sd.title("k1") === "en attente\nde Claude", "touche en attente");
	});

	test("inspecteur : diagnostic, puis « Installer les hooks » écrit settings.json avec sauvegarde", async () => {
		sd.openInspector("k1");
		sd.toPlugin("k1", { event: "status" });
		const before = await waitFor(() => sd.toInspector("status"), "statut");
		assert.equal(before.server.ok, true);
		assert.match(before.server.text, new RegExp(`127.0.0.1:${HOOK_PORT}`));
		assert.equal(before.hooks.ok, false);
		assert.equal(before.lastHook, null);

		sd.toPlugin("k1", { event: "install" });
		const after = await waitFor(() => (sd.toInspector("status")?.result ? sd.toInspector("status") : null), "résultat");
		assert.equal(after.result.ok, true, after.result.text);
		assert.equal(after.hooks.ok, true, after.hooks.text);
		const settings = JSON.parse(readFileSync(SETTINGS, "utf8"));
		assert.equal(settings.model, "opus");
		assert.equal(settings.hooks.Stop[0].hooks[0].url, `${BASE}Stop`);
		assert.ok(readdirSync(CONFIG_DIR).some((f) => f.startsWith("settings.json.bak-")));
	});

	test("liste des sessions et touche réglée sur un projet", async () => {
		sd.appear("k2", 1);
		await hook("UserPromptSubmit", "alpha", "C:\\dev\\alpha");
		await hook("PreToolUse", "beta", "C:\\dev\\beta", { tool_name: "Bash" });
		await waitFor(() => sd.title("k1") === "alpha\ntravaille", "k1 = alpha");
		await waitFor(() => sd.title("k2") === "beta\ntravaille", "k2 = beta");

		sd.toPlugin("k1", { event: "sessions" });
		const list = await waitFor(() => (sd.toInspector("sessions")?.items.length === 3 ? sd.toInspector("sessions") : null), "liste");
		assert.deepEqual(
			list.items.map((i) => i.value),
			["", "C:\\dev\\alpha", "C:\\dev\\beta"],
		);
		const status = await waitFor(() => (sd.toInspector("status")?.lastHook ? sd.toInspector("status") : null), "dernier hook");
		assert.equal(status.lastHook.project, "beta");

		// k1 (à gauche) choisit beta : alpha passe sur la touche automatique k2.
		sd.settings("k1", 0, { project: "c:/dev/BETA", projectLabel: "beta" });
		await waitFor(() => sd.title("k1") === "beta\ntravaille", "k1 suit beta");
		await waitFor(() => sd.title("k2") === "alpha\ntravaille", "k2 reprend alpha");

		await hook("PermissionRequest", "beta", "C:\\dev\\beta", { tool_name: "Bash" });
		await waitFor(() => sd.title("k1") === "beta\nPERMIS ?", "permission");

		// Fin de session puis nouvelle session dans le même dossier : la touche la retrouve.
		await hook("SessionEnd", "beta", "C:\\dev\\beta", { reason: "other" });
		await waitFor(() => sd.title("k1") === "BETA\nfermée", "beta fermée");
		await hook("SessionStart", "beta2", "C:\\dev\\beta", { source: "startup" });
		await waitFor(() => sd.title("k1") === "beta\nrepos", "nouvelle session beta");
	});

	test("« Retirer les hooks » rend le settings.json d'origine", async () => {
		sd.toPlugin("k1", { event: "uninstall" });
		await waitFor(() => /retirés/.test(sd.toInspector("status")?.result?.text ?? ""), "retrait");
		assert.deepEqual(JSON.parse(readFileSync(SETTINGS, "utf8")), { model: "opus" });
	});

	test("plugin arrêté : Claude Code reçoit une erreur de connexion immédiate (hook non bloquant)", async () => {
		child.kill();
		await new Promise((r) => child.once("exit", r));
		const t0 = performance.now();
		await assert.rejects(hook("Stop", "beta2", "C:\\dev\\beta"));
		assert.ok(performance.now() - t0 < 1000);
	});
});
