/** Bundle the test entry (with a defineTool stub) then run it under node:test. */

import { build } from "esbuild";
import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";

mkdirSync("test/.build", { recursive: true });
await build({
	entryPoints: ["test/portal.test.ts"],
	bundle: true,
	platform: "node",
	format: "esm",
	target: "node20",
	outfile: "test/.build/portal.test.js",
	alias: { "@deepseek-ai/dsh-tools": "./test/stub-dsh-tools.ts" },
	external: ["playwright"],
	logLevel: "warning",
});
const run = spawnSync(process.execPath, ["--test", "test/.build/portal.test.js"], { stdio: "inherit" });
process.exit(run.status ?? 1);
