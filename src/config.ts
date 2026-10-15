/** Port d'écoute par défaut du serveur de hooks (réglable dans l'inspecteur en D1). */
export const DEFAULT_PORT = 47615;

/** Hôte d'écoute : boucle locale uniquement, jamais exposé au réseau. */
export const HOST = "127.0.0.1";

/** Préfixe des routes ; sert aussi à reconnaître nos hooks dans les réglages de Claude Code. */
export const ROUTE_PREFIX = "/claude-streamdeck/";

/** URL d'un hook pour un événement donné. */
export function hookUrl(port: number, event: string): string {
	return `http://${HOST}:${port}${ROUTE_PREFIX}${event}`;
}

/**
 * Événements Claude Code écoutés (noms vérifiés dans https://code.claude.com/docs/en/hooks le 2026-10-15).
 */
export const HOOK_EVENTS = [
	"SessionStart",
	"UserPromptSubmit",
	"PreToolUse",
	"PostToolUse",
	"PostToolUseFailure",
	"PermissionRequest",
	"PermissionDenied",
	"Notification",
	"Elicitation",
	"ElicitationResult",
	"SubagentStart",
	"Stop",
	"StopFailure",
	"PostModelSwitch",
	"SessionEnd",
] as const;

export type HookEventName = (typeof HOOK_EVENTS)[number];

/**
 * Délai max (secondes) laissé à Claude Code pour joindre le plugin. Le défaut des hooks
 * HTTP est de 600 s : un plugin figé bloquerait Claude, d'où une valeur courte.
 */
export const HOOK_TIMEOUT_S = 5;
