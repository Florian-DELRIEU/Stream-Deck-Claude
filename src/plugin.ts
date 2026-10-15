import streamDeck from "@elgato/streamdeck";

import { SessionAction } from "./actions/session";
import { DEFAULT_PORT } from "./config";
import { HookServer } from "./server/hook-server";
import { SessionManager } from "./sessions/session-manager";

streamDeck.logger.setLevel("info");
const logger = streamDeck.logger.createScope("hooks");

const sessions = new SessionManager();
streamDeck.actions.registerAction(new SessionAction(sessions));

// Port : réglable plus tard dans l'inspecteur (D1) ; variable d'environnement pour les tests.
const port = Number(process.env.CLAUDE_STREAMDECK_PORT) || DEFAULT_PORT;
const server = new HookServer({
	port,
	logger,
	onEvent: (ev) => {
		const s = sessions.handle(ev);
		logger.info(`${ev.hook_event_name} ${ev.session_id.slice(0, 8)} [${s.project}] → ${s.state}`);
	},
});

server.listen().then(
	(p) => logger.info(`Serveur de hooks à l'écoute sur 127.0.0.1:${p}`),
	(err: NodeJS.ErrnoException) =>
		logger.error(
			err.code === "EADDRINUSE"
				? `Port ${port} déjà utilisé : les hooks de Claude Code ne seront pas reçus.`
				: `Démarrage du serveur de hooks impossible : ${err.message}`,
		),
);

setInterval(() => sessions.pruneStale(), 10 * 60_000).unref();

await streamDeck.connect();
