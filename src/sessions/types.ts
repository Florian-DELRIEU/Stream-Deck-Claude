import type { HookEventName } from "../config";

/** États d'une session (tableau « États d'une session » de docs/PLAN-V1.md). */
export type SessionState =
	| "idle" // Au repos
	| "working" // Travaille
	| "waiting-permission" // Attend une permission
	| "waiting-input" // Attend ta réponse
	| "done" // Terminée
	| "error" // Erreur
	| "closed"; // Fermée

/** Corps JSON reçu d'un hook. Seuls les champs utilisés sont typés ; le reste est ignoré. */
export interface HookEvent {
	hook_event_name: HookEventName;
	session_id: string;
	cwd?: string;
	transcript_path?: string;
	permission_mode?: string;
	effort?: { level?: string };
	agent_id?: string;
	agent_type?: string;
	// SessionStart
	source?: string;
	model?: string;
	// Outils
	tool_name?: string;
	tool_input?: Record<string, unknown>;
	// PostToolUseFailure : texte de l'erreur ; StopFailure : type d'erreur (rate_limit…)
	error?: string;
	is_interrupt?: boolean;
	// Notification
	notification_type?: string;
	message?: string;
	// StopFailure / Stop
	last_assistant_message?: string;
	// PostModelSwitch
	to_model?: string;
	// SessionEnd
	reason?: string;
}

export interface SessionError {
	kind: "tool" | "api";
	/** Type d'erreur d'API (rate_limit, overloaded…) ou nom de l'outil en échec. */
	type: string;
	/** Fin de l'affichage pour une erreur brève (échec d'outil) ; absent = durable. */
	until?: number;
}

export interface Session {
	id: string;
	/** Nom court du projet : dernier segment du dossier courant. */
	project: string;
	cwd: string;
	state: SessionState;
	/** Ordre d'apparition, sert à attribuer les emplacements. */
	order: number;
	startedAt: number;
	lastActivity: number;
	/** Début de la tâche en cours (dernier prompt). */
	taskStartedAt?: number;
	/** Fin de la dernière tâche (Stop). */
	taskEndedAt?: number;
	currentTool?: string;
	currentFile?: string;
	/** Outil pour lequel une permission est demandée. */
	pendingTool?: string;
	model?: string;
	effort?: string;
	permissionMode?: string;
	transcriptPath?: string;
	error?: SessionError;
}
