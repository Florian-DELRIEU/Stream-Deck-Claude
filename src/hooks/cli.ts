/**
 * Installe ou retire les hooks du plugin dans les réglages utilisateur de Claude Code.
 *
 *   node bin/hooks-cli.js install   [--port N] [--settings chemin]
 *   node bin/hooks-cli.js uninstall [--settings chemin]
 *   node bin/hooks-cli.js status    [--settings chemin]
 *
 * Par défaut : %USERPROFILE%\.claude\settings.json (ou $CLAUDE_CONFIG_DIR/settings.json).
 * Avant toute écriture, une copie horodatée est faite à côté du fichier.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { DEFAULT_PORT, HOOK_EVENTS } from "../config";
import { addHooks, installedHooks, removeHooks } from "./installer";

type Json = Record<string, unknown>;

function defaultSettingsPath(): string {
	const dir = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), ".claude");
	return path.join(dir, "settings.json");
}

function parseArgs(argv: string[]): { command?: string; port: number; file: string } {
	let port = DEFAULT_PORT;
	let file = defaultSettingsPath();
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

function read(file: string): { settings: Json; exists: boolean } {
	if (!existsSync(file)) return { settings: {}, exists: false };
	const text = readFileSync(file, "utf8");
	if (text.trim() === "") return { settings: {}, exists: true };
	let data: unknown;
	try {
		data = JSON.parse(text);
	} catch (err) {
		throw new Error(`${file} n'est pas un JSON valide, rien n'a été modifié (${(err as Error).message})`);
	}
	if (typeof data !== "object" || data === null || Array.isArray(data)) {
		throw new Error(`${file} ne contient pas un objet JSON, rien n'a été modifié`);
	}
	return { settings: data as Json, exists: true };
}

function stamp(d = new Date()): string {
	const p = (n: number) => String(n).padStart(2, "0");
	return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function write(file: string, settings: Json, exists: boolean): string | undefined {
	let backup: string | undefined;
	if (exists) {
		backup = `${file}.bak-${stamp()}`;
		copyFileSync(file, backup);
	} else {
		mkdirSync(path.dirname(file), { recursive: true });
	}
	const tmp = `${file}.tmp-${process.pid}`;
	writeFileSync(tmp, JSON.stringify(settings, null, 2) + "\n", "utf8");
	renameSync(tmp, file);
	return backup;
}

function main(): number {
	const { command, port, file } = parseArgs(process.argv.slice(2));
	const { settings, exists } = read(file);

	switch (command) {
		case "install": {
			const backup = write(file, addHooks(settings, port), exists);
			console.log(`Hooks installés (${HOOK_EVENTS.length} événements, port ${port}) dans ${file}`);
			if (backup) console.log(`Sauvegarde : ${backup}`);
			console.log("Les sessions Claude Code déjà ouvertes les prennent en compte au prochain démarrage.");
			return 0;
		}
		case "uninstall": {
			if (installedHooks(settings).length === 0) {
				console.log(`Aucun hook du plugin dans ${file}, rien à retirer.`);
				return 0;
			}
			const backup = write(file, removeHooks(settings), exists);
			console.log(`Hooks retirés de ${file}`);
			if (backup) console.log(`Sauvegarde : ${backup}`);
			return 0;
		}
		case "status": {
			const found = installedHooks(settings);
			if (found.length === 0) console.log(`Aucun hook du plugin dans ${file}`);
			else {
				const ports = [...new Set(found.map((f) => f.port))].join(", ");
				console.log(`${found.length} hook(s) du plugin dans ${file} (port ${ports}) :`);
				console.log("  " + found.map((f) => f.event).join(", "));
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
