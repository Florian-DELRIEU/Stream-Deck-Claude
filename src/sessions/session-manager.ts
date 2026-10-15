import { EventEmitter } from "node:events";

import { applyEvent, createSession, expireError } from "./state-machine";
import type { HookEvent, Session } from "./types";

export interface SessionManagerOptions {
	/** Regroupement des notifications de changement (ms) pour ne pas saturer l'affichage. */
	debounceMs?: number;
	/** Une session sans activité depuis ce délai est oubliée (terminal fermé sans SessionEnd). */
	staleMs?: number;
	now?: () => number;
}

/**
 * Tient une fiche par session et émet `change` (regroupé) quand l'une d'elles évolue.
 */
export class SessionManager extends EventEmitter<{ change: [] }> {
	private readonly sessions = new Map<string, Session>();
	private nextOrder = 0;
	private changeTimer?: NodeJS.Timeout;
	private readonly errorTimers = new Map<string, NodeJS.Timeout>();
	private readonly debounceMs: number;
	private readonly staleMs: number;
	private readonly now: () => number;

	constructor(opts: SessionManagerOptions = {}) {
		super();
		this.debounceMs = opts.debounceMs ?? 50;
		this.staleMs = opts.staleMs ?? 12 * 3600_000;
		this.now = opts.now ?? Date.now;
	}

	handle(ev: HookEvent): Session {
		const now = this.now();
		const prev = this.sessions.get(ev.session_id) ?? createSession(ev, this.nextOrder++, now);
		const next = applyEvent(prev, ev, now);

		if (next.state === "closed") {
			this.sessions.delete(next.id);
			this.clearErrorTimer(next.id);
		} else {
			this.sessions.set(next.id, next);
			this.scheduleErrorExpiry(next);
		}
		this.notify();
		return next;
	}

	get(id: string): Session | undefined {
		return this.sessions.get(id);
	}

	/** Sessions ouvertes, par ordre d'apparition (= ordre des emplacements). */
	list(): Session[] {
		return [...this.sessions.values()].sort((a, b) => a.order - b.order);
	}

	/** Nombre de sessions qui attendent Florian (permission ou réponse). */
	needsYouCount(): number {
		return this.list().filter((s) => s.state === "waiting-permission" || s.state === "waiting-input").length;
	}

	/** Oublie les sessions inactives depuis trop longtemps. */
	pruneStale(): void {
		const limit = this.now() - this.staleMs;
		let changed = false;
		for (const s of this.sessions.values()) {
			if (s.lastActivity < limit) {
				this.sessions.delete(s.id);
				this.clearErrorTimer(s.id);
				changed = true;
			}
		}
		if (changed) this.notify();
	}

	dispose(): void {
		clearTimeout(this.changeTimer);
		for (const t of this.errorTimers.values()) clearTimeout(t);
		this.errorTimers.clear();
	}

	private scheduleErrorExpiry(s: Session): void {
		this.clearErrorTimer(s.id);
		const until = s.error?.until;
		if (until === undefined) return;
		const timer = setTimeout(() => {
			this.errorTimers.delete(s.id);
			const cur = this.sessions.get(s.id);
			if (!cur) return;
			const next = expireError(cur, this.now());
			if (next !== cur) {
				this.sessions.set(next.id, next);
				this.notify();
			}
		}, Math.max(0, until - this.now()));
		timer.unref();
		this.errorTimers.set(s.id, timer);
	}

	private clearErrorTimer(id: string): void {
		clearTimeout(this.errorTimers.get(id));
		this.errorTimers.delete(id);
	}

	private notify(): void {
		if (this.changeTimer) return;
		this.changeTimer = setTimeout(() => {
			this.changeTimer = undefined;
			this.emit("change");
		}, this.debounceMs);
		this.changeTimer.unref();
	}
}
