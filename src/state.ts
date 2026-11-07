/**
 * Per-session web-tool state (`/web on|learn|off`, conversation default
 * profile).
 *
 * Pi stores this in conversation branch history. DSH has no equivalent
 * public append API for plugin-owned state, so the plugin keeps a small
 * preference file under its data dir (`<dataDir>/state.json`, 0600) and
 * rebuilds the in-memory cache at activation. This state only decides which
 * tool schemas are visible; it never carries model-visible conversation data.
 */

import { readFileSync, writeFileSync, renameSync, existsSync } from "node:fs";
import { join } from "node:path";
import { getConfig } from "./config.js";
import { dataDir, ensureDir, stateFile } from "./core/shared/paths.js";

interface SessionState {
	web: boolean;
	learn: boolean;
	/** Conversation-scoped default profile override (`none`, `session`, name). */
	defaultProfile?: string;
	updatedAt: number;
}

interface StateFile {
	version: 1;
	sessions: Record<string, SessionState>;
}

const STALE_AFTER_MS = 30 * 24 * 60 * 60 * 1000;

let sessions = new Map<string, SessionState>();
let loaded = false;
let writeTimer: ReturnType<typeof setTimeout> | undefined;

function defaults(): SessionState {
	const config = getConfig();
	return {
		web: config.defaultEnabled,
		learn: config.defaultLearn,
		updatedAt: Date.now(),
	};
}

/** Load state.json (best-effort) and drop entries older than 30 days. */
export function loadToggleState(): string[] {
	const warnings: string[] = [];
	sessions = new Map();
	loaded = true;
	const file = stateFile();
	if (!existsSync(file)) return warnings;
	try {
		const parsed = JSON.parse(readFileSync(file, "utf-8")) as StateFile;
		const now = Date.now();
		for (const [id, entry] of Object.entries(parsed?.sessions ?? {})) {
			if (!entry || typeof entry !== "object") continue;
			if (typeof entry.updatedAt === "number" && now - entry.updatedAt > STALE_AFTER_MS) continue;
			sessions.set(id, {
				web: typeof entry.web === "boolean" ? entry.web : getConfig().defaultEnabled,
				learn: typeof entry.learn === "boolean" ? entry.learn : getConfig().defaultLearn,
				...(typeof entry.defaultProfile === "string" ? { defaultProfile: entry.defaultProfile } : {}),
				updatedAt: typeof entry.updatedAt === "number" ? entry.updatedAt : now,
			});
		}
	} catch (err) {
		warnings.push(`state.json: could not be read (${err instanceof Error ? err.message : String(err)}); using defaults`);
	}
	return warnings;
}

function stateFor(sessionId: string): SessionState {
	if (!loaded) loadToggleState();
	let state = sessions.get(sessionId);
	if (!state) {
		state = defaults();
		sessions.set(sessionId, state);
	}
	return state;
}

export function isWebEnabled(sessionId: string): boolean {
	return stateFor(sessionId).web;
}

export function isLearnEnabled(sessionId: string): boolean {
	return stateFor(sessionId).learn;
}

export function getSessionDefaultProfile(sessionId: string): string | undefined {
	return stateFor(sessionId).defaultProfile;
}

export function setWebEnabled(sessionId: string, enabled: boolean): void {
	const state = stateFor(sessionId);
	state.web = enabled;
	state.updatedAt = Date.now();
	scheduleWrite();
}

export function setLearnEnabled(sessionId: string, enabled: boolean): void {
	const state = stateFor(sessionId);
	state.learn = enabled;
	state.updatedAt = Date.now();
	scheduleWrite();
}

export function setSessionDefaultProfile(sessionId: string, profile: string | undefined): void {
	const state = stateFor(sessionId);
	if (profile === undefined) delete state.defaultProfile;
	else state.defaultProfile = profile;
	state.updatedAt = Date.now();
	scheduleWrite();
}

/** Remove state for an agent that left the registry. */
export function forgetSession(sessionId: string): void {
	if (sessions.delete(sessionId)) scheduleWrite();
}

function persist(): void {
	try {
		ensureDir(dataDir());
		const payload: StateFile = { version: 1, sessions: Object.fromEntries(sessions) };
		const target = stateFile();
		const tmp = join(dataDir(), `.state.${process.pid}.${Date.now()}.tmp`);
		writeFileSync(tmp, JSON.stringify(payload, null, 2), { mode: 0o600 });
		renameSync(tmp, target);
	} catch {
		/* best-effort preference cache */
	}
}

/** Debounced write so a burst of toggles touches the disk once. */
function scheduleWrite(): void {
	if (writeTimer) clearTimeout(writeTimer);
	writeTimer = setTimeout(() => {
		writeTimer = undefined;
		persist();
	}, 100);
	if (typeof writeTimer === "object" && writeTimer && "unref" in writeTimer) {
		(writeTimer as unknown as { unref(): void }).unref();
	}
}

/** Flush pending writes (plugin unload / tests). */
export function flushToggleState(): void {
	if (writeTimer) {
		clearTimeout(writeTimer);
		writeTimer = undefined;
	}
	persist();
}

/** Test-only reset. */
export function resetToggleStateForTests(): void {
	sessions = new Map();
	loaded = false;
	if (writeTimer) clearTimeout(writeTimer);
	writeTimer = undefined;
}
