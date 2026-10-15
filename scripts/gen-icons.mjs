// Génère les images du plugin en pixel art (SVG net + PNG agrandi sans lissage).
// Usage : node scripts/gen-icons.mjs
// Sprites originaux sur une grille 16×16 : invite de terminal « >_ » dans un cadre.
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { deflateSync } from "node:zlib";

const ROOT = "com.zv-claude-streamdeck.sdPlugin/imgs";

// Palette chaude sur fond sombre (provisoire, figée en B1).
const PAL = {
	".": null, // transparent
	b: "#1E1A17", // fond
	f: "#5A4636", // cadre
	o: "#D97757", // orange argile
	c: "#F3E9DC", // crème
};

// prettier-ignore
const PROMPT = [
	"ffffffffffffffff",
	"fbbbbbbbbbbbbbbf",
	"fbbbbbbbbbbbbbbf",
	"fbbbbbbbbbbbbbbf",
	"fbboobbbbbbbbbbf",
	"fbbboobbbbbbbbbf",
	"fbbbboobbbbbbbbf",
	"fbbbbboobbbbbbbf",
	"fbbbboobbbbbbbbf",
	"fbbboobbbbbbbbbf",
	"fbboobbbbccccbbf",
	"fbbbbbbbbccccbbf",
	"fbbbbbbbbbbbbbbf",
	"fbbbbbbbbbbbbbbf",
	"fbbbbbbbbbbbbbbf",
	"ffffffffffffffff",
];

// Icône monochrome (liste d'actions, catégorie) : seulement le « >_ », sans fond.
const MONO = PROMPT.map((row) => row.replace(/[bf]/g, ".").replace(/[oc]/g, "w"));
const MONO_PAL = { ".": null, w: "#FFFFFF" };

// Fond de touche : cadre et fond seuls, le titre s'affiche par-dessus.
const KEY = PROMPT.map((row, y) => (y === 0 || y === 15 ? row : "f" + "b".repeat(14) + "f"));

function svg(grid, pal, size) {
	const n = grid.length;
	let rects = "";
	grid.forEach((row, y) =>
		[...row].forEach((ch, x) => {
			if (pal[ch]) rects += `<rect x="${x}" y="${y}" width="1" height="1" fill="${pal[ch]}"/>`;
		}),
	);
	return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges">${rects}</svg>\n`;
}

// --- PNG minimal (RGBA 8 bits), agrandi au plus proche voisin --------------------
const CRC = new Int32Array(256).map((_, n) => {
	let c = n;
	for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
	return c;
});
function crc32(buf) {
	let c = -1;
	for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
	return (c ^ -1) >>> 0;
}
function chunk(type, data) {
	const len = Buffer.alloc(4);
	len.writeUInt32BE(data.length);
	const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
	const crc = Buffer.alloc(4);
	crc.writeUInt32BE(crc32(td));
	return Buffer.concat([len, td, crc]);
}
function png(grid, pal, size) {
	const n = grid.length;
	const raw = Buffer.alloc(size * (size * 4 + 1));
	for (let y = 0; y < size; y++) {
		raw[y * (size * 4 + 1)] = 0;
		for (let x = 0; x < size; x++) {
			const hex = pal[grid[Math.floor((y * n) / size)][Math.floor((x * n) / size)]];
			const o = y * (size * 4 + 1) + 1 + x * 4;
			if (hex) {
				raw[o] = parseInt(hex.slice(1, 3), 16);
				raw[o + 1] = parseInt(hex.slice(3, 5), 16);
				raw[o + 2] = parseInt(hex.slice(5, 7), 16);
				raw[o + 3] = 255;
			}
		}
	}
	const ihdr = Buffer.alloc(13);
	ihdr.writeUInt32BE(size, 0);
	ihdr.writeUInt32BE(size, 4);
	ihdr.set([8, 6, 0, 0, 0], 8);
	return Buffer.concat([
		Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
		chunk("IHDR", ihdr),
		chunk("IDAT", deflateSync(raw)),
		chunk("IEND", Buffer.alloc(0)),
	]);
}

function out(rel, content) {
	const file = path.join(ROOT, rel);
	mkdirSync(path.dirname(file), { recursive: true });
	writeFileSync(file, content);
	console.log("écrit", file);
}

out("plugin/marketplace.svg", svg(PROMPT, PAL, 288));
out("plugin/marketplace.png", png(PROMPT, PAL, 288));
out("plugin/marketplace@2x.png", png(PROMPT, PAL, 512));
out("plugin/category-icon.svg", svg(MONO, MONO_PAL, 28));
out("actions/session/icon.svg", svg(MONO, MONO_PAL, 20));
out("actions/session/key.svg", svg(KEY, PAL, 144));
