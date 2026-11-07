/**
 * Portal configuration — DeepSeek Harness plugin config.
 *
 * Replaces the Pi extension's settings.json reader. The config
 * object comes from the Loader row in the profile's `cordis.patch.yml`; every
 * field is optional and validated here because the bundle ships no
 * Schemastery schema.
 */

import { homedir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";

export type EngineName = "chromium" | "firefox";

export interface PortalConfig {
	/** Persistent root for everything this plugin writes. */
	dataDir: string;
	/** Playwright browser-binary cache (`PLAYWRIGHT_BROWSERS_PATH`). */
	browsersPath: string;
	/** `"none"`, `"session"`, or a named profile. */
	defaultProfile: string;
	/** Built-in backends in priority order (first = `strategy: "auto"`). */
	engines: EngineName[];
	defaultEnabled: boolean;
	defaultLearn: boolean;
	maxStorageStateSize: number;
	screenshot: boolean;
	timeoutSeconds: number;
	headless: boolean;
}

const BUILTIN_ENGINES: EngineName[] = ["chromium", "firefox"];
const RESERVED_PROFILES = new Set([
	"none",
	"session",
	"create",
	"list",
	"clear",
	"clear-all",
	"prune",
]);
const PROFILE_NAME_RE = /^[a-zA-Z0-9_-]{1,64}$/;

let current: PortalConfig | undefined;

/** DSH home, honouring the environment the Host was launched with. */
export function dshHome(): string {
	const home = process.env.DSH_HOME;
	return home && home.trim() ? resolve(home) : join(homedir(), ".dsh");
}

function defaultConfig(): PortalConfig {
	const dataDir = join(dshHome(), "playwright");
	return {
		dataDir,
		browsersPath: join(dataDir, "browsers"),
		defaultProfile: "session",
		engines: [...BUILTIN_ENGINES],
		defaultEnabled: true,
		defaultLearn: false,
		maxStorageStateSize: 10 * 1024 * 1024,
		screenshot: true,
		timeoutSeconds: 30,
		headless: true,
	};
}

function expandHome(value: string): string {
	if (value === "~") return homedir();
	if (value.startsWith("~/")) return join(homedir(), value.slice(2));
	return value;
}

function readPath(value: unknown, fallback: string, label: string, warnings: string[]): string {
	if (value === undefined) return fallback;
	if (typeof value !== "string" || !value.trim()) {
		warnings.push(`${label}: expected a non-empty string, using ${fallback}`);
		return fallback;
	}
	const expanded = expandHome(value.trim());
	if (!isAbsolute(expanded)) {
		warnings.push(`${label}: must be an absolute path, using ${fallback}`);
		return fallback;
	}
	return resolve(expanded);
}

/**
 * Validate one raw plugin config object and publish it as the process-wide
 * config. Unknown keys warn once; invalid values fall back to defaults.
 */
export function configure(raw: unknown): { config: PortalConfig; warnings: string[] } {
	const warnings: string[] = [];
	const config = defaultConfig();

	if (raw !== undefined && (typeof raw !== "object" || raw === null || Array.isArray(raw))) {
		warnings.push("config: expected an object, using defaults");
	} else if (raw) {
		const r = raw as Record<string, unknown>;
		config.dataDir = readPath(r.dataDir, config.dataDir, "dataDir", warnings);
		config.browsersPath =
			r.browsersPath === undefined
				? join(config.dataDir, "browsers")
				: readPath(r.browsersPath, join(config.dataDir, "browsers"), "browsersPath", warnings);

		if (r.defaultProfile !== undefined) {
			const v = typeof r.defaultProfile === "string" ? r.defaultProfile.trim() : "";
			if (!v) {
				warnings.push("defaultProfile: expected a non-empty string");
			} else if (v === "none" || v === "session" || (PROFILE_NAME_RE.test(v) && !RESERVED_PROFILES.has(v))) {
				config.defaultProfile = v;
			} else {
				warnings.push(`defaultProfile: invalid profile name '${v}'`);
			}
		}

		if (r.engines !== undefined) {
			if (!Array.isArray(r.engines)) {
				warnings.push("engines: expected an array of engine names");
			} else {
				const engines: EngineName[] = [];
				for (const entry of r.engines) {
					const name = typeof entry === "string" ? entry.trim().toLowerCase() : "";
					if (!BUILTIN_ENGINES.includes(name as EngineName)) {
						warnings.push(`engines: unknown engine '${String(entry)}' (built-in: chromium, firefox)`);
					} else if (!engines.includes(name as EngineName)) {
						engines.push(name as EngineName);
					}
				}
				if (engines.length === 0) {
					warnings.push("engines: no usable engine, falling back to chromium + firefox");
				} else {
					config.engines = engines;
				}
			}
		}

		for (const [key, target] of [
			["defaultEnabled", "defaultEnabled"],
			["defaultLearn", "defaultLearn"],
			["screenshot", "screenshot"],
			["headless", "headless"],
		] as const) {
			const value = r[key];
			if (value === undefined) continue;
			if (typeof value !== "boolean") {
				warnings.push(`${key}: expected a boolean`);
			} else {
				config[target] = value;
			}
		}

		const maxSize = r.maxStorageStateSize;
		if (maxSize !== undefined) {
			if (typeof maxSize !== "number" || !Number.isFinite(maxSize) || maxSize <= 0) {
				warnings.push("maxStorageStateSize: expected a positive number");
			} else {
				config.maxStorageStateSize = Math.floor(maxSize);
			}
		}

		const timeout = r.timeoutSeconds;
		if (timeout !== undefined) {
			if (typeof timeout !== "number" || !Number.isFinite(timeout) || timeout < 1 || timeout > 120) {
				warnings.push("timeoutSeconds: expected a number between 1 and 120");
			} else {
				config.timeoutSeconds = Math.floor(timeout);
			}
		}
	}

	current = config;
	return { config, warnings };
}

/** Resolved config. Throws only when read before `configure` ran. */
export function getConfig(): PortalConfig {
	if (!current) throw new Error("playwright-portal config has not been initialized");
	return current;
}

export const BUILTIN_ENGINE_NAMES: readonly EngineName[] = BUILTIN_ENGINES;
