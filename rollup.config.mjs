import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import nodeResolve from "@rollup/plugin-node-resolve";
import terser from "@rollup/plugin-terser";
import typescript from "@rollup/plugin-typescript";
import path from "node:path";
import url from "node:url";

const isWatching = !!process.env.ROLLUP_WATCH;
const sdPlugin = "com.zv-claude-streamdeck.sdPlugin";

const plugins = () => [
	typescript({ mapRoot: isWatching ? "./" : undefined }),
	nodeResolve({ browser: false, exportConditions: ["node"], preferBuiltins: true }),
	commonjs(),
	json(),
	!isWatching && terser(),
];

const output = (file) => ({
	file: `${sdPlugin}/bin/${file}`,
	sourcemap: isWatching,
	sourcemapPathTransform: (relativeSourcePath, sourcemapPath) => {
		return url.pathToFileURL(path.resolve(path.dirname(sourcemapPath), relativeSourcePath)).href;
	},
});

/**
 * Deux bundles autonomes. Aucun module natif : tout est bundlé,
 * y compris @elgato/streamdeck (ne jamais l'externaliser).
 * @type {import('rollup').RollupOptions[]}
 */
export default [
	{
		input: "src/plugin.ts",
		output: output("plugin.js"),
		plugins: [
			{
				name: "watch-externals",
				buildStart: function () {
					this.addWatchFile(`${sdPlugin}/manifest.json`);
				},
			},
			...plugins(),
			{
				name: "emit-module-package-file",
				generateBundle() {
					this.emitFile({ fileName: "package.json", source: `{ "type": "module" }`, type: "asset" });
				},
			},
		],
	},
	{
		// Installeur de hooks, lancé à la main : node bin/hooks-cli.js install
		input: "src/hooks/cli.ts",
		output: output("hooks-cli.js"),
		plugins: plugins(),
	},
];
