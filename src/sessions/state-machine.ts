import type { HookEvent, Session, SessionState } from "./types";

/** Durée d'affichage d'un échec d'outil avant retour à « Travaille ». */
export const TOOL_ERROR_MS = 3000;

/** Notifications qui signifient « Claude attend ta réponse ». */
const INPUT_NOTIFICATIONS = new Set(["idle_prompt", "agent_needs_input", "elicitation_dialog", "elicitation_url_dialog"]);

export function projectName(cwd: string | undefined): string {
	if (!cwd) return "?";
	const parts = cwd.split(/[\\/]+/).filter(Boolean);
	return parts.at(-1) ?? cwd;
}

/** Fiche d'une session vue pour la première fois (au démarrage, ou après un redémarrage du plugin). */
export function createSession(ev: HookEvent, order: number, now: number): Session {
	return {
		id: ev.session_id,
		project: projectName(ev.cwd),
		cwd: ev.cwd ?? "",
		state: "idle",
		order,
		startedAt: now,
		lastActivity: now,
	};
}

function fileOf(input: Record<string, unknown> | undefined): string | undefined {
	const p = input?.file_path ?? input?.notebook_path ?? input?.path;
	return typeof p === "string" ? p : undefined;
}

function to(s: Session, state: SessionState, patch: Partial<Session> = {}): Session {
	const next: Session = { ...s, ...patch, state };
	if (state !== "error") delete next.error;
	if (state !== "waiting-permission") delete next.pendingTool;
	return next;
}

/**
 * Applique un événement de hook à une session. Fonction pure : renvoie une nouvelle fiche.
 */
export function applyEvent(prev: Session, ev: HookEvent, now: number): Session {
	let s: Session = { ...prev, lastActivity: now };
	if (ev.cwd) {
		s.cwd = ev.cwd;
		s.project = projectName(ev.cwd);
	}
	if (ev.transcript_path) s.transcriptPath = ev.transcript_path;
	if (ev.permission_mode) s.permissionMode = ev.permission_mode;
	if (ev.effort?.level) s.effort = ev.effort.level;

	const fromSubagent = !!ev.agent_id;

	switch (ev.hook_event_name) {
		case "SessionStart":
			if (ev.model) s.model = ev.model;
			// Un compactage arrive en pleine tâche : l'état ne change pas.
			if (ev.source === "compact") return s;
			return to(s, "idle", { taskStartedAt: undefined, taskEndedAt: undefined, currentTool: undefined, currentFile: undefined });

		case "UserPromptSubmit":
			return to(s, "working", { taskStartedAt: now, taskEndedAt: undefined, currentTool: undefined, currentFile: undefined });

		case "PreToolUse": {
			const patch: Partial<Session> = { currentTool: ev.tool_name, currentFile: fileOf(ev.tool_input) };
			// Une permission en attente le reste tant que l'outil concerné n'a pas tourné
			// (des outils lancés en parallèle peuvent démarrer pendant ce temps).
			if (s.state === "waiting-permission") return { ...s, ...patch };
			return to(s, "working", { taskStartedAt: s.taskStartedAt ?? now, ...patch });
		}

		case "PostToolUse":
		case "PermissionDenied":
		case "SubagentStart":
		case "ElicitationResult":
			return to(s, "working", { taskStartedAt: s.taskStartedAt ?? now });

		case "PostToolUseFailure":
			// Échap pendant un outil : Claude rend la main (Stop ne se déclenche pas dans ce cas).
			if (ev.is_interrupt) return to(s, "done", { taskEndedAt: now, currentTool: undefined });
			return to(s, "error", {
				error: { kind: "tool", type: ev.tool_name ?? "outil", until: now + TOOL_ERROR_MS },
			});

		case "PermissionRequest":
			return to(s, "waiting-permission", { pendingTool: ev.tool_name });

		case "Notification":
			if (ev.notification_type === "permission_prompt") return to(s, "waiting-permission", { pendingTool: s.pendingTool });
			if (ev.notification_type && INPUT_NOTIFICATIONS.has(ev.notification_type)) return to(s, "waiting-input");
			return s;

		case "Elicitation":
			return to(s, "waiting-input");

		case "Stop":
			if (fromSubagent) return s;
			return to(s, "done", { taskEndedAt: now, currentTool: undefined, currentFile: undefined });

		case "StopFailure":
			return to(s, "error", { taskEndedAt: now, currentTool: undefined, error: { kind: "api", type: ev.error ?? "unknown" } });

		case "PostModelSwitch":
			if (ev.to_model) s.model = ev.to_model;
			return s;

		case "SessionEnd":
			return to(s, "closed", { currentTool: undefined });

		default:
			return s;
	}
}

/** Fin d'une erreur brève : retour à « Travaille ». Renvoie la même fiche si rien ne change. */
export function expireError(s: Session, now: number): Session {
	if (s.state === "error" && s.error?.until !== undefined && s.error.until <= now) {
		return to(s, "working");
	}
	return s;
}
