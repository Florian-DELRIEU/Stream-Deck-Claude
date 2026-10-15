import { HOOK_EVENTS, HOOK_TIMEOUT_S, ROUTE_PREFIX, hookUrl } from "../config";

type Json = Record<string, unknown>;

interface HookHandler {
	type?: string;
	url?: string;
	[k: string]: unknown;
}

interface MatcherGroup {
	matcher?: string;
	hooks?: HookHandler[];
	[k: string]: unknown;
}

/** Un handler est à nous si son URL vise notre préfixe de route en boucle locale. */
export function isOurHandler(h: HookHandler): boolean {
	return (
		h?.type === "http" &&
		typeof h.url === "string" &&
		/^http:\/\/(127\.0\.0\.1|localhost):\d+\//.test(h.url) &&
		new URL(h.url).pathname.startsWith(ROUTE_PREFIX)
	);
}

function hooksObject(settings: Json): Record<string, MatcherGroup[]> | undefined {
	const h = settings.hooks;
	return typeof h === "object" && h !== null && !Array.isArray(h) ? (h as Record<string, MatcherGroup[]>) : undefined;
}

/**
 * Retire nos hooks sans toucher au reste. Les groupes et événements vidés par ce retrait
 * sont supprimés ; ceux qui étaient déjà vides restent tels quels.
 */
export function removeHooks(settings: Json): Json {
	const out = structuredClone(settings);
	const hooks = hooksObject(out);
	if (!hooks) return out;
	const wasEmpty = Object.keys(hooks).length === 0;

	for (const [event, groups] of Object.entries(hooks)) {
		if (!Array.isArray(groups)) continue;
		let touched = false;
		const kept: MatcherGroup[] = [];
		for (const group of groups) {
			if (!Array.isArray(group?.hooks)) {
				kept.push(group);
				continue;
			}
			const handlers = group.hooks.filter((h) => !isOurHandler(h));
			if (handlers.length === group.hooks.length) kept.push(group);
			else {
				touched = true;
				if (handlers.length > 0) kept.push({ ...group, hooks: handlers });
			}
		}
		if (!touched) continue;
		if (kept.length > 0) hooks[event] = kept;
		else delete hooks[event];
	}
	if (!wasEmpty && Object.keys(hooks).length === 0) delete out.hooks;
	return out;
}

/** Ajoute nos hooks (après avoir retiré d'éventuels anciens : réinstaller ne duplique rien). */
export function addHooks(settings: Json, port: number): Json {
	const out = removeHooks(settings);
	const hooks = hooksObject(out) ?? {};
	for (const event of HOOK_EVENTS) {
		const groups = Array.isArray(hooks[event]) ? hooks[event] : [];
		groups.push({ hooks: [{ type: "http", url: hookUrl(port, event), timeout: HOOK_TIMEOUT_S }] });
		hooks[event] = groups;
	}
	out.hooks = hooks;
	return out;
}

/** Événements où nos hooks sont présents, avec leur port. */
export function installedHooks(settings: Json): { event: string; port: number }[] {
	const found: { event: string; port: number }[] = [];
	for (const [event, groups] of Object.entries(hooksObject(settings) ?? {})) {
		if (!Array.isArray(groups)) continue;
		for (const group of groups) {
			for (const h of Array.isArray(group?.hooks) ? group.hooks : []) {
				if (isOurHandler(h)) found.push({ event, port: Number(new URL(h.url!).port) });
			}
		}
	}
	return found;
}
