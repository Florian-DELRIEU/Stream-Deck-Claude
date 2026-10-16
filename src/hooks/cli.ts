/**
 * Installe ou retire les hooks du plugin dans les réglages utilisateur de Claude Code.
 * (Le plus simple reste le bouton « Installer les hooks » dans les réglages de la touche.)
 *
 *   node bin/hooks-cli.js install   [--port N] [--settings chemin]
 *   node bin/hooks-cli.js uninstall [--settings chemin]
 *   node bin/hooks-cli.js status    [--settings chemin]
 */
import path from "node:path";

import { DEFAULT_PORT, HOOK_EVENTS } from "../config";
import { installToFile, settingsPath, statusOfFile, uninstallFromFile } from "./settings-file";

function parseArgs(argv: string[]): { command?: string; port: number; file: string } {
	let port = DEFAULT_PORT;
	let file = settingsPath();
	let command: string | undefined;
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		if (a === "--port") port = Number(argv[++i]);
		else if (a === "--settings") file = path.resolve(argv[++i] ?? "");
		else if (!command) command = a;
	}
	if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error(`Port invalide : ${port}`);
	return { command, port, file };
}

function main(): number {
	const { command, port, file } = parseArgs(process.argv.slice(2));

	switch (command) {
		case "install": {
			const { backup } = installToFile(port, file);
			console.log(`Hooks installés (${HOOK_EVENTS.length} événements, port ${port}) dans ${file}`);
			if (backup) console.log(`Sauvegarde : ${backup}`);
			return 0;
		}
		case "uninstall": {
			const { changed, backup } = uninstallFromFile(file);
			if (!changed) {
				console.log(`Aucun hook du plugin dans ${file}, rien à retirer.`);
				return 0;
			}
			console.log(`Hooks retirés de ${file}`);
			if (backup) console.log(`Sauvegarde : ${backup}`);
			return 0;
		}
		case "status": {
			const { installed } = statusOfFile(file);
			if (installed.length === 0) console.log(`Aucun hook du plugin dans ${file}`);
			else {
				const ports = [...new Set(installed.map((f) => f.port))].join(", ");
				console.log(`${installed.length} hook(s) du plugin dans ${file} (port ${ports}) :`);
				console.log("  " + installed.map((f) => f.event).join(", "));
			}
			return 0;
		}
		default:
			console.error("Usage : node hooks-cli.js install|uninstall|status [--port N] [--settings chemin]");
			return 2;
	}
}

try {
	process.exitCode = main();
} catch (err) {
	console.error(`Erreur : ${(err as Error).message}`);
	process.exitCode = 1;
}
