// Test de bout en bout : lance le plugin compilé (bin/plugin.js) face à un faux logiciel
// Stream Deck (WebSocket), puis lui envoie de vrais POST de hooks comme le ferait Claude Code.
// Prérequis : npm run build.
import { spawn } from "node:child_process";
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
	appear(context, column, row = 0) {
		this.send({
			event: "willAppear",
			action: SESSION,
			context,
			device: "dev1",
			payload: { settings: {}, coordinates: { column, row }, controller: "Keypad", state: 0, isInMultiAction: false },
		});
	}
	stop() {
		return new Promise((resolve) => this.wss.close(resolve));
	}
}

const hook = (event, session_id, extra = {}) =>
	fetch(BASE + event, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ hook_event_name: event, session_id, cwd: `C:\\dev\\${session_id}`, ...extra }),
	});

describe("plugin Claude Deck (bout en bout)", () => {
	const sd = new FakeStreamDeck();
	let child;
	let stderr = "";

	before(async () => {
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
			{ cwd: PLUGIN_DIR, env: { ...process.env, CLAUDE_STREAMDECK_PORT: String(HOOK_PORT) } },
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

	test("deux touches, deux sessions : chacune suit son état", async () => {
		// Touche de droite posée en premier : l'ordre suit la position, pas l'apparition.
		sd.appear("k2", 1);
		sd.appear("k1", 0);
		await waitFor(() => sd.last("setTitle", "k1")?.payload.title === "—", "touche vide");

		const t0 = performance.now();
		const res = await hook("SessionStart", "alpha", { source: "startup" });
		assert.equal(res.status, 200);
		assert.ok(performance.now() - t0 < 200);

		await hook("UserPromptSubmit", "alpha", { prompt: "go" });
		await hook("PreToolUse", "beta", { tool_name: "Bash" }); // session inconnue : créée
		await waitFor(() => sd.last("setTitle", "k1")?.payload.title === "alpha\ntravaille", "k1 = alpha travaille");
		await waitFor(() => sd.last("setTitle", "k2")?.payload.title === "beta\ntravaille", "k2 = beta travaille");

		await hook("PermissionRequest", "beta", { tool_name: "Bash", tool_input: { command: "rm -rf build" } });
		await waitFor(() => sd.last("setTitle", "k2")?.payload.title === "beta\nPERMIS ?", "k2 attend une permission");

		await hook("Stop", "alpha");
		await waitFor(() => sd.last("setTitle", "k1")?.payload.title === "alpha\nfini", "k1 terminée");

		await hook("SessionEnd", "alpha", { reason: "other" });
		await waitFor(() => sd.last("setTitle", "k1")?.payload.title === "beta\nPERMIS ?", "beta remonte en k1");
		await waitFor(() => sd.last("setTitle", "k2")?.payload.title === "—", "k2 libérée");
	});

	test("plugin arrêté : Claude Code reçoit une erreur de connexion immédiate (hook non bloquant)", async () => {
		child.kill();
		await new Promise((r) => child.once("exit", r));
		const t0 = performance.now();
		await assert.rejects(hook("Stop", "beta"));
		assert.ok(performance.now() - t0 < 1000);
	});
});
