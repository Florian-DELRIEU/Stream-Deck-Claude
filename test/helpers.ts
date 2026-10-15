import type { HookEvent } from "../src/sessions/types";

/** Fabrique un événement de hook minimal. */
export function ev(hook_event_name: HookEvent["hook_event_name"], extra: Partial<HookEvent> = {}, session_id = "s1"): HookEvent {
	return { hook_event_name, session_id, cwd: "C:\\Users\\flo\\projets\\mon-projet", ...extra };
}
