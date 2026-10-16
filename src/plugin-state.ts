import { EventEmitter } from "node:events";

import type { HookEvent } from "./sessions/types";

export type ServerState = { state: "starting" } | { state: "listening"; port: number } | { state: "error"; message: string };

export interface LastHook {
	at: number;
	event: string;
	project: string;
}

/**
 * Ce que le plugin sait de sa liaison avec Claude Code, pour le diagnostic
 * (touches et inspecteur) : état du serveur et dernier hook reçu.
 */
export class PluginState extends EventEmitter<{ change: [] }> {
	server: ServerState = { state: "starting" };
	lastHook?: LastHook;

	constructor(readonly port: number) {
		super();
	}

	setServer(server: ServerState): void {
		this.server = server;
		this.emit("change");
	}

	/** Appelé à chaque hook ; les touches se redessinent déjà via le gestionnaire de sessions. */
	hookReceived(ev: HookEvent, project: string, now = Date.now()): void {
		this.lastHook = { at: now, event: ev.hook_event_name, project };
	}
}
