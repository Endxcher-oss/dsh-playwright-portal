/**
 * Bundle the adapted TypeScript sources into the single ESM entry DSH loads.
 *
 * `playwright` stays external (resolved from this package's node_modules) and
 * DSH's own packages stay external (resolved by the Host's plugin resolver).
 */

import { build } from "esbuild";
import { mkdirSync } from "node:fs";

mkdirSync("lib", { recursive: true });

const result = await build({
	entryPoints: ["src/index.ts"],
	bundle: true,
	platform: "node",
	format: "esm",
	target: "node20",
	outfile: "lib/index.js",
	external: ["playwright", "playwright-core"],
	legalComments: "inline",
	logLevel: "warning",
	metafile: true,
});

const outputs = Object.entries(result.metafile.outputs);
for (const [file, meta] of outputs) {
	console.log(`built ${file} (${(meta.bytes / 1024).toFixed(1)} KiB)`);
}
