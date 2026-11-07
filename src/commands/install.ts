/**
 * Bundled Playwright CLI resolution, browser detection, and `/web install`.
 *
 * Resolving the CLI from the same `playwright` package the backends import
 * guarantees the installed browser revisions match. Every browser binary is
 * written below `<dataDir>/browsers` via `PLAYWRIGHT_BROWSERS_PATH`.
 */

import { spawn } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { createRequire } from "node:module";
import { browsersPath } from "../core/shared/paths.js";

export const ENGINES = ["chromium", "firefox"] as const;
export type Engine = (typeof ENGINES)[number];

const ENGINE_SIZES: Record<Engine, string> = { chromium: "~170 MB", firefox: "~90 MB" };

export interface BundledPlaywright {
	cliJs: string;
	nodeExe: string;
}

/** Node interpreter for the CLI. `process.execPath` is a Node binary here. */
export function resolveNodeInterpreter(): string {
	return basename(process.execPath).replace(/\.exe$/i, "") === "node" ? process.execPath : "node";
}

/** Resolve the bundled Playwright CLI lazily; throws when it is missing. */
export function resolveBundledPlaywright(): BundledPlaywright {
	const req = createRequire(import.meta.url);
	const pkgDir = dirname(req.resolve("playwright/package.json"));
	return { cliJs: join(pkgDir, "cli.js"), nodeExe: resolveNodeInterpreter() };
}

function hasDir(prefix: string): boolean {
	const dir = browsersPath();
	if (!existsSync(dir)) return false;
	try {
		return readdirSync(dir).some((entry) => entry === prefix || entry.startsWith(`${prefix}-`));
	} catch {
		return false;
	}
}

/** Browser presence by install directory (no launch, cheap for status). */
export function detectInstalledBrowsers(): Record<Engine, boolean> {
	return {
		chromium: hasDir("chromium") || hasDir("chromium_headless_shell"),
		firefox: hasDir("firefox"),
	};
}

export function manualInstallHint(): string {
	return `Install: ${resolveNodeInterpreter()} <bundle>/node_modules/playwright/cli.js install chromium firefox\n` +
		`Browsers will be written to ${browsersPath()}`;
}

export interface InstallOutcome {
	ok: boolean;
	text: string;
}

/** Run the bundled CLI for the requested engines and capture bounded output. */
export async function runBrowserInstall(engines: Engine[], signal?: AbortSignal): Promise<InstallOutcome> {
	let bundled: BundledPlaywright;
	try {
		bundled = resolveBundledPlaywright();
	} catch {
		return {
			ok: false,
			text: "Playwright is not available in this plugin installation.\n" + manualInstallHint(),
		};
	}

	const env = { ...process.env, PLAYWRIGHT_BROWSERS_PATH: browsersPath() };
	const listed = engines.map((engine) => `${engine} ${ENGINE_SIZES[engine]}`).join(", ");
	return await new Promise<InstallOutcome>((resolve) => {
		let output = "";
		let settled = false;
		const finish = (outcome: InstallOutcome) => {
			if (settled) return;
			settled = true;
			resolve(outcome);
		};

		const child = spawn(bundled.nodeExe, [bundled.cliJs, "install", ...engines], {
			env,
			stdio: ["ignore", "pipe", "pipe"],
		});
		const timer = setTimeout(() => {
			try {
				child.kill("SIGKILL");
			} catch {
				/* ignore */
			}
			finish({
				ok: false,
				text: `Browser install timed out after 10 minutes (${listed}).\n${manualInstallHint()}`,
			});
		}, 10 * 60 * 1000);
		const collect = (chunk: Buffer) => {
			output = (output + chunk.toString()).slice(-8_000);
		};
		child.stdout?.on("data", collect);
		child.stderr?.on("data", collect);
		child.on("error", (err) => {
			clearTimeout(timer);
			finish({ ok: false, text: `Browser install failed: ${err.message}\n${manualInstallHint()}` });
		});
		child.on("close", (code) => {
			clearTimeout(timer);
			if (code === 0) {
				finish({
					ok: true,
					text: `✅ Browsers installed (${listed}) under ${browsersPath()}\n${output.trim()}`,
				});
			} else {
				finish({
					ok: false,
					text: `Browser install failed (exit code ${code}).\n${output.trim()}\n${manualInstallHint()}`,
				});
			}
		});
		if (signal) {
			signal.addEventListener(
				"abort",
				() => {
					try {
						child.kill("SIGKILL");
					} catch {
						/* ignore */
					}
					finish({ ok: false, text: "Browser install cancelled." });
				},
				{ once: true },
			);
		}
	});
}
