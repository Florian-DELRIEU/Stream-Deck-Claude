import type { Session, SessionState } from "../sessions/types";

/** Une touche « Session » posée : position et projet choisi dans ses réglages ("" = automatique). */
export interface KeySlot {
	id: string;
	device: string;
	row: number;
	column: number;
	project: string;
}

/** Compare deux dossiers sans tenir compte de la casse ni du sens des séparateurs (Windows). */
export function dirKey(dir: string): string {
	return dir.replace(/[\\/]+/g, "/").replace(/\/$/, "").toLowerCase();
}

/**
 * Attribue une session à chaque touche.
 * - Touche réglée sur un projet : la session ouverte la plus récente de ce dossier.
 * - Touche automatique : les sessions des projets non réservés, dans leur ordre de démarrage,
 *   réparties de gauche à droite puis de haut en bas (un ordre par appareil).
 */
export function assignSessions(keys: KeySlot[], sessions: Session[]): Map<string, Session | undefined> {
	const out = new Map<string, Session | undefined>();
	const reserved = new Set(keys.filter((k) => k.project).map((k) => dirKey(k.project)));

	for (const key of keys) {
		if (!key.project) continue;
		const dir = dirKey(key.project);
		const mine = sessions.filter((s) => dirKey(s.cwd) === dir);
		out.set(key.id, mine.sort((a, b) => b.lastActivity - a.lastActivity)[0]);
	}

	const free = sessions.filter((s) => !reserved.has(dirKey(s.cwd))).sort((a, b) => a.order - b.order);
	const autoByDevice = new Map<string, KeySlot[]>();
	for (const key of keys) {
		if (key.project) continue;
		autoByDevice.set(key.device, [...(autoByDevice.get(key.device) ?? []), key]);
	}
	for (const group of autoByDevice.values()) {
		group.sort((a, b) => a.row - b.row || a.column - b.column);
		group.forEach((key, i) => out.set(key.id, free[i]));
	}
	return out;
}

export const STATE_LABELS: Record<SessionState, string> = {
	idle: "repos",
	working: "travaille",
	"waiting-permission": "PERMIS ?",
	"waiting-input": "à toi",
	done: "fini",
	error: "erreur",
	closed: "fermée",
};

/** Nom court qui tient sur une touche. */
export function shortName(name: string, width = 8): string {
	return name.length > width ? name.slice(0, width - 1) + "…" : name;
}

export function projectOf(dir: string): string {
	return dir.split(/[\\/]+/).filter(Boolean).at(-1) ?? dir;
}

export interface TitleContext {
	serverError: boolean;
	anyHookReceived: boolean;
}

/** Titre d'une touche : la session, ou ce qui manque pour en afficher une. */
export function keyTitle(key: Pick<KeySlot, "project">, session: Session | undefined, ctx: TitleContext): string {
	if (ctx.serverError) return "port\noccupé";
	if (session) return `${shortName(session.project)}\n${STATE_LABELS[session.state]}`;
	if (!ctx.anyHookReceived) return "en attente\nde Claude";
	if (key.project) return `${shortName(projectOf(key.project))}\nfermée`;
	return "—";
}
