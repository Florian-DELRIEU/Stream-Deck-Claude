import http from "node:http";
import type { AddressInfo } from "node:net";

import { HOOK_EVENTS, HOST, ROUTE_PREFIX } from "../config";
import type { HookEvent } from "../sessions/types";

export interface Logger {
	debug(...args: unknown[]): unknown;
	info(...args: unknown[]): unknown;
	warn(...args: unknown[]): unknown;
	error(...args: unknown[]): unknown;
}

export interface HookServerOptions {
	port: number;
	onEvent: (ev: HookEvent) => void;
	logger: Logger;
}

const MAX_BODY = 1024 * 1024;
const KNOWN_EVENTS = new Set<string>(HOOK_EVENTS);

export type ValidationResult = { ok: true; event: HookEvent } | { ok: false; reason: string };

/** Vérifie le corps d'un hook reçu sur la route `/…/<route>`. */
export function validateHook(route: string, body: string): ValidationResult {
	let data: unknown;
	try {
		data = JSON.parse(body);
	} catch {
		return { ok: false, reason: "JSON invalide" };
	}
	if (typeof data !== "object" || data === null || Array.isArray(data)) return { ok: false, reason: "objet JSON attendu" };
	const obj = data as Record<string, unknown>;
	if (typeof obj.session_id !== "string" || obj.session_id === "") return { ok: false, reason: "session_id manquant" };
	if (obj.hook_event_name !== route) return { ok: false, reason: `hook_event_name ≠ ${route}` };
	return { ok: true, event: obj as unknown as HookEvent };
}

function hostAllowed(host: string | undefined, port: number): boolean {
	// Refuse les requêtes venues d'une page web via un nom de domaine (DNS rebinding).
	return host === `${HOST}:${port}` || host === `localhost:${port}`;
}

/**
 * Serveur local qui reçoit les hooks HTTP de Claude Code.
 * Il répond toujours immédiatement (200, corps vide = « continuer ») et traite l'événement ensuite :
 * il ne bloque ni ne ralentit jamais Claude Code.
 */
export class HookServer {
	private server?: http.Server;

	constructor(private readonly opts: HookServerOptions) {}

	get port(): number | undefined {
		return (this.server?.address() as AddressInfo | null)?.port;
	}

	listen(): Promise<number> {
		const server = http.createServer((req, res) => this.handle(req, res));
		server.keepAliveTimeout = 5000;
		this.server = server;
		return new Promise((resolve, reject) => {
			server.once("error", reject);
			server.listen(this.opts.port, HOST, () => {
				server.off("error", reject);
				server.on("error", (err) => this.opts.logger.error("Serveur de hooks :", err));
				resolve(this.port!);
			});
		});
	}

	close(): Promise<void> {
		const server = this.server;
		this.server = undefined;
		if (!server) return Promise.resolve();
		server.closeAllConnections();
		return new Promise((resolve) => server.close(() => resolve()));
	}

	private handle(req: http.IncomingMessage, res: http.ServerResponse): void {
		const { logger } = this.opts;
		const reply = (status: number, text = ""): void => {
			if (res.headersSent) return;
			res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
			res.end(text);
		};

		if (!hostAllowed(req.headers.host, this.port ?? this.opts.port)) return reply(403, "hôte refusé");

		const url = req.url?.split("?")[0] ?? "";
		if (req.method === "GET" && url === `${ROUTE_PREFIX}health`) return reply(200, "ok");

		if (!url.startsWith(ROUTE_PREFIX)) return reply(404);
		const route = url.slice(ROUTE_PREFIX.length);
		if (!KNOWN_EVENTS.has(route)) return reply(404);
		if (req.method !== "POST") return reply(405);

		const chunks: Buffer[] = [];
		let size = 0;
		req.on("data", (chunk: Buffer) => {
			size += chunk.length;
			if (size > MAX_BODY) {
				reply(413);
				req.destroy();
				return;
			}
			chunks.push(chunk);
		});
		req.on("error", () => {});
		req.on("end", () => {
			if (size > MAX_BODY) return;
			const result = validateHook(route, Buffer.concat(chunks).toString("utf8"));
			if (!result.ok) {
				logger.warn(`Hook ${route} rejeté : ${result.reason}`);
				return reply(400, result.reason);
			}
			// Réponse d'abord, traitement ensuite.
			reply(200);
			setImmediate(() => {
				try {
					this.opts.onEvent(result.event);
				} catch (err) {
					logger.error(`Traitement du hook ${route} :`, err);
				}
			});
		});
	}
}
