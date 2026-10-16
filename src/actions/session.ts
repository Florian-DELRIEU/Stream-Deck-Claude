import streamDeck, {
	action,
	type DidReceiveSettingsEvent,
	type KeyAction,
	type PropertyInspectorDidAppearEvent,
	type PropertyInspectorDidDisappearEvent,
	type SendToPluginEvent,
	SingletonAction,
	type WillAppearEvent,
	type WillDisappearEvent,
} from "@elgato/streamdeck";
import type { JsonObject, JsonValue } from "@elgato/utils";

import { HOOK_EVENTS } from "../config";
import { installToFile, statusOfFile, uninstallFromFile } from "../hooks/settings-file";
import type { PluginState } from "../plugin-state";
import type { SessionManager } from "../sessions/session-manager";
import { STATE_LABELS, assignSessions, dirKey, type KeySlot, keyTitle, projectOf } from "./assign";

type SessionSettings = {
	/** Dossier du projet suivi par la touche ; vide = automatique. */
	project?: string;
	projectLabel?: string;
};

type SelectItem = { label: string; value: string; disabled?: boolean };

/**
 * Action « Session » (texte pour l'instant ; le rendu pixel arrive en B1/B2).
 * Dans ses réglages : le projet à suivre, et la connexion à Claude Code (installation des hooks, diagnostic).
 */
@action({ UUID: "com.zv-claude-streamdeck.session" })
export class SessionAction extends SingletonAction<SessionSettings> {
	private readonly slots = new Map<string, KeySlot>();
	/** Résultat du dernier clic sur Installer / Retirer, affiché dans l'inspecteur. */
	private lastResult?: { ok: boolean; text: string };
	/** Inspecteur ouvert : le diagnostic lui est poussé à chaque changement. */
	private inspectorOpen = false;
	private inspectorActionId?: string;

	constructor(
		private readonly sessions: SessionManager,
		private readonly state: PluginState,
	) {
		super();
		const onChange = () => {
			this.refreshAll();
			if (!this.inspectorOpen) return;
			this.pushStatus();
			this.pushSessions();
		};
		sessions.on("change", onChange);
		state.on("change", onChange);
	}

	override onPropertyInspectorDidAppear(ev: PropertyInspectorDidAppearEvent<SessionSettings>): void {
		this.inspectorOpen = true;
		this.inspectorActionId = ev.action.id;
	}

	override onPropertyInspectorDidDisappear(_ev: PropertyInspectorDidDisappearEvent<SessionSettings>): void {
		this.inspectorOpen = false;
		this.lastResult = undefined;
	}

	override onWillAppear(ev: WillAppearEvent<SessionSettings>): void {
		const c = ev.payload.isInMultiAction ? undefined : ev.payload.coordinates;
		this.slots.set(ev.action.id, {
			id: ev.action.id,
			device: ev.action.device.id,
			row: c?.row ?? 0,
			column: c?.column ?? 0,
			project: ev.payload.settings.project ?? "",
		});
		this.refreshAll();
	}

	override onWillDisappear(ev: WillDisappearEvent<SessionSettings>): void {
		this.slots.delete(ev.action.id);
		this.refreshAll();
	}

	override onDidReceiveSettings(ev: DidReceiveSettingsEvent<SessionSettings>): void {
		const slot = this.slots.get(ev.action.id);
		if (slot) slot.project = ev.payload.settings.project ?? "";
		this.refreshAll();
	}

	override onSendToPlugin(ev: SendToPluginEvent<JsonValue, SessionSettings>): void {
		const payload = ev.payload as { event?: string };
		switch (payload.event) {
			case "sessions":
				this.inspectorActionId = ev.action.id;
				this.pushSessions();
				break;
			case "status":
				this.pushStatus();
				break;
			case "install":
				this.runFileCommand(() => {
					const { file, backup } = installToFile(this.state.port);
					return `Hooks installés dans ${file}.` + (backup ? ` Sauvegarde : ${backup}` : "");
				});
				break;
			case "uninstall":
				this.runFileCommand(() => {
					const { file, changed, backup } = uninstallFromFile();
					if (!changed) return `Aucun hook du plugin dans ${file}.`;
					return `Hooks retirés de ${file}.` + (backup ? ` Sauvegarde : ${backup}` : "");
				});
				break;
		}
	}

	private pushSessions(): void {
		const selected = this.inspectorActionId ? (this.slots.get(this.inspectorActionId)?.project ?? "") : "";
		void this.send({ event: "sessions", items: this.sessionItems(selected) });
	}

	/** Liste déroulante : Automatique, les sessions ouvertes, et le projet déjà choisi s'il n'est plus ouvert. */
	private sessionItems(selected: string): SelectItem[] {
		const items: SelectItem[] = [{ label: "Automatique (ordre de démarrage)", value: "" }];
		const seen = new Set<string>();
		for (const s of this.sessions.list()) {
			const key = dirKey(s.cwd);
			if (!s.cwd || seen.has(key)) continue;
			seen.add(key);
			items.push({ label: `${s.project} — ${STATE_LABELS[s.state]}`, value: s.cwd });
		}
		if (selected && !seen.has(dirKey(selected))) {
			items.push({ label: `${projectOf(selected)} — pas ouvert`, value: selected });
		}
		if (items.length === 1) {
			items.push({ label: "Aucune session ouverte : envoie un prompt dans Claude Code", value: "__none__", disabled: true });
		}
		return items;
	}

	private runFileCommand(fn: () => string): void {
		try {
			this.lastResult = { ok: true, text: fn() };
		} catch (err) {
			this.lastResult = { ok: false, text: (err as Error).message };
			streamDeck.logger.error(this.lastResult.text);
		}
		this.pushStatus();
	}

	private pushStatus(): void {
		const { server, lastHook, port } = this.state;
		let hooks: { ok: boolean; text: string; file?: string };
		try {
			const { file, installed } = statusOfFile();
			const ports = [...new Set(installed.map((h) => h.port))];
			if (installed.length === 0) hooks = { ok: false, text: "absents : clique sur « Installer les hooks »", file };
			else if (ports.length !== 1 || ports[0] !== port)
				hooks = { ok: false, text: `installés sur un autre port (${ports.join(", ")}) : réinstalle-les`, file };
			else if (installed.length < HOOK_EVENTS.length)
				hooks = { ok: false, text: `incomplets (${installed.length}/${HOOK_EVENTS.length}) : réinstalle-les`, file };
			else hooks = { ok: true, text: `installés (${installed.length} événements)`, file };
		} catch (err) {
			hooks = { ok: false, text: (err as Error).message };
		}

		void this.send({
			event: "status",
			server:
				server.state === "listening"
					? { ok: true, text: `à l'écoute sur 127.0.0.1:${server.port}` }
					: server.state === "error"
						? { ok: false, text: server.message }
						: { ok: false, text: "démarrage…" },
			hooks,
			lastHook: lastHook ? { ...lastHook } : null,
			sessions: this.sessions.list().length,
			result: this.lastResult ?? null,
		});
	}

	private async send(payload: JsonValue): Promise<void> {
		try {
			await streamDeck.ui.sendToPropertyInspector(payload);
		} catch {
			// aucun inspecteur ouvert : rien à faire
		}
	}

	private refreshAll(): void {
		const keys: KeyAction<SessionSettings>[] = [];
		for (const a of this.actions) if (a.isKey()) keys.push(a);
		const slots = keys.map((k) => this.slots.get(k.id)).filter((s): s is KeySlot => !!s);
		const assigned = assignSessions(slots, this.sessions.list());
		const ctx = { serverError: this.state.server.state === "error", anyHookReceived: !!this.state.lastHook };
		for (const key of keys) {
			const slot = this.slots.get(key.id);
			if (slot) void key.setTitle(keyTitle(slot, assigned.get(key.id), ctx));
		}
	}
}
