/**
 * Path & filename utilities — the single source of truth for every file this
 * plugin writes.
 *
 * Unlike the Pi extension (which hard-coded a home-directory data root and the
 * OS temp directory), all roots are derived from the plugin config at
 * `apply` time. By default the whole tree lives under `$DSH_HOME/playwright`.
 */

import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { getConfig } from "../../config.js";

/** Directories computed from the active config. */
interface PortalPaths {
	dataDir: string;
	browserStateDir: string;
	guidesDir: string;
	artifactsDir: string;
	browsersPath: string;
	stateFile: string;
}

let paths: PortalPaths | undefined;

/** Compute and publish the path set. Called once from `apply`. */
export function configurePaths(): PortalPaths {
	const config = getConfig();
	paths = {
		dataDir: config.dataDir,
		browserStateDir: join(config.dataDir, "browser-state"),
		guidesDir: join(config.dataDir, "web-guides"),
		artifactsDir: join(config.dataDir, "artifacts"),
		browsersPath: config.browsersPath,
		stateFile: join(config.dataDir, "state.json"),
	};
	return paths;
}

function active(): PortalPaths {
	if (!paths) throw new Error("playwright-portal paths have not been configured");
	return paths;
}

export const dataDir = (): string => active().dataDir;
export const browserStateDir = (): string => active().browserStateDir;
export const guidesDir = (): string => active().guidesDir;
export const artifactsDir = (): string => active().artifactsDir;
export const browsersPath = (): string => active().browsersPath;
export const stateFile = (): string => active().stateFile;

/** Best-effort recursive directory creation (0700 for user data). */
export function ensureDir(dir: string, mode: number = 0o700): void {
	try {
		mkdirSync(dir, { recursive: true, mode });
	} catch {
		/* best-effort: callers surface their own I/O errors */
	}
}

export function ensureArtifactsDir(): void {
	ensureDir(artifactsDir());
}

export function ensureGuidesDir(): void {
	ensureDir(guidesDir());
}

export function ensureBrowserStateDir(): void {
	ensureDir(browserStateDir());
}

/**
 * Sanitize an arbitrary id for use in a filename.
 * Task ids come from DSH session ids, which are already filename-safe, but
 * session ids are sanitized again before being embedded in profile names.
 */
export function safeTaskId(taskId: string): string {
	return taskId.replace(/[^a-zA-Z0-9-]/g, "_");
}

/** Human-readable byte count (B, KB, MB). */
export function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
