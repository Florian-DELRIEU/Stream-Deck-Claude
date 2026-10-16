/**
 * Lecture et écriture du fichier de réglages utilisateur de Claude Code.
 * Partagé par la ligne de commande (bin/hooks-cli.js) et l'inspecteur de la touche.
 * Garanties : sauvegarde horodatée avant toute écriture, fusion (jamais remplacement),
 * abandon sans écrire si le fichier n'est pas un JSON valide.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { addHooks, installedHooks, removeHooks } from "./installer";

type Json = Record<string, unknown>;

/** %USERPROFILE%\.claude\settings.json, ou $CLAUDE_CONFIG_DIR/settings.json. */
export function settingsPath(): string {
	const dir = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), ".claude");
	return path.join(dir, "settings.json");
}

export function readSettings(file: string): { settings: Json; exists: boolean } {
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

/** Écrit le fichier (via un fichier temporaire) ; renvoie le chemin de la sauvegarde s'il y en a une. */
function writeSettings(file: string, settings: Json, exists: boolean): string | undefined {
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

export interface HooksStatus {
	file: string;
	installed: { event: string; port: number }[];
}

export function statusOfFile(file = settingsPath()): HooksStatus {
	return { file, installed: installedHooks(readSettings(file).settings) };
}

export function installToFile(port: number, file = settingsPath()): { file: string; backup?: string } {
	const { settings, exists } = readSettings(file);
	return { file, backup: writeSettings(file, addHooks(settings, port), exists) };
}

/** Retire nos hooks ; `changed: false` s'il n'y avait rien à retirer (aucune écriture). */
export function uninstallFromFile(file = settingsPath()): { file: string; changed: boolean; backup?: string } {
	const { settings, exists } = readSettings(file);
	if (installedHooks(settings).length === 0) return { file, changed: false };
	return { file, changed: true, backup: writeSettings(file, removeHooks(settings), exists) };
}
