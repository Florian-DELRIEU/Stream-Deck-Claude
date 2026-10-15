import { action, type KeyAction, SingletonAction, type WillAppearEvent, type WillDisappearEvent } from "@elgato/streamdeck";
import type { JsonObject } from "@elgato/utils";

import type { SessionManager } from "../sessions/session-manager";
import type { Session, SessionState } from "../sessions/types";

const LABELS: Record<SessionState, string> = {
	idle: "repos",
	working: "travaille",
	"waiting-permission": "PERMIS ?",
	"waiting-input": "à toi",
	done: "fini",
	error: "erreur",
	closed: "fermée",
};

export function sessionTitle(s: Session | undefined): string {
	if (!s) return "—";
	const name = s.project.length > 8 ? s.project.slice(0, 7) + "…" : s.project;
	return `${name}\n${LABELS[s.state]}`;
}

interface Slot {
	device: string;
	row: number;
	column: number;
}

/**
 * Action « session » (version texte du jalon A ; le rendu pixel arrive en B1/B2).
 * Chaque touche posée est un emplacement : de gauche à droite et de haut en bas,
 * elles reçoivent les sessions dans leur ordre de démarrage.
 */
@action({ UUID: "com.zv-claude-streamdeck.session" })
export class SessionAction extends SingletonAction<JsonObject> {
	private readonly slots = new Map<string, Slot>();

	constructor(private readonly sessions: SessionManager) {
		super();
		sessions.on("change", () => this.refreshAll());
	}

	override onWillAppear(ev: WillAppearEvent<JsonObject>): void {
		const c = ev.payload.isInMultiAction ? undefined : ev.payload.coordinates;
		this.slots.set(ev.action.id, { device: ev.action.device.id, row: c?.row ?? 0, column: c?.column ?? 0 });
		this.refreshAll();
	}

	override onWillDisappear(ev: WillDisappearEvent<JsonObject>): void {
		this.slots.delete(ev.action.id);
		this.refreshAll();
	}

	private refreshAll(): void {
		const list = this.sessions.list();
		const keys: KeyAction<JsonObject>[] = [];
		for (const a of this.actions) if (a.isKey()) keys.push(a);
		// Un ordre par appareil : chaque Stream Deck affiche ses sessions à partir de la première.
		const byDevice = new Map<string, KeyAction<JsonObject>[]>();
		for (const key of keys) {
			const slot = this.slots.get(key.id);
			if (!slot) continue;
			byDevice.set(slot.device, [...(byDevice.get(slot.device) ?? []), key]);
		}
		for (const group of byDevice.values()) {
			group.sort((a, b) => {
				const sa = this.slots.get(a.id)!;
				const sb = this.slots.get(b.id)!;
				return sa.row - sb.row || sa.column - sb.column;
			});
			group.forEach((key, i) => void key.setTitle(sessionTitle(list[i])));
		}
	}
}
