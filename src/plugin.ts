import streamDeck from "@elgato/streamdeck";

import { SessionAction } from "./actions/session";
import { DEFAULT_PORT } from "./config";
import { PluginState } from "./plugin-state";
import { HookServer } from "./server/hook-server";
import { SessionManager } from "./sessions/session-manager";

streamDeck.logger.setLevel("info");
const logger = streamDeck.logger.createScope("hooks");

// Port : réglable plus tard dans l'inspecteur (D1) ; variable d'environnement pour les tests.
const port = Number(process.env.CLAUDE_STREAMDECK_PORT) || DEFAULT_PORT;

const sessions = new SessionManager();
const state = new PluginState(port);
streamDeck.actions.registerAction(new SessionAction(sessions, state));

const server = new HookServer({
	port,
	logger,
	onEvent: (ev) => {
		const s = sessions.handle(ev);
		state.hookReceived(ev, s.project);
		logger.info(`${ev.hook_event_name} ${ev.session_id.slice(0, 8)} [${s.project}] → ${s.state}`);
	},
});

server.listen().then(
	(p) => {
		logger.info(`Serveur de hooks à l'écoute sur 127.0.0.1:${p}`);
		state.setServer({ state: "listening", port: p });
	},
	(err: NodeJS.ErrnoException) => {
		const message =
			err.code === "EADDRINUSE"
				? `port ${port} déjà utilisé par un autre programme`
				: `démarrage impossible : ${err.message}`;
		logger.error(`Serveur de hooks : ${message}`);
		state.setServer({ state: "error", message });
	},
);

setInterval(() => sessions.pruneStale(), 10 * 60_000).unref();

await streamDeck.connect();
