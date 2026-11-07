/**
 * `/web` command — toggle, status, install, profiles, cookies.
 *
 * Pi's TUI (dialogs, status widgets, notifications) is replaced by plain
 * command results; semantics follow the upstream `/web` command.
 */

import { existsSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import * as router from "../core/router.js";
import { pluginRegistry } from "../core/plugin-registry.js";
import { sessionManager } from "../core/shared/session-manager.js";
import { formatBytes, browserStateDir, browsersPath, dataDir } from "../core/shared/paths.js";
import {
	deleteStorageState,
	getProfileLabel,
	isSessionProfile,
	isSessionStale,
	pruneStaleSessionProfiles,
	profileDir,
	sanitizeProfileName,
} from "../core/shared/storage-state.js";
import {
	getSessionDefaultProfile,
	isLearnEnabled,
	isWebEnabled,
	setLearnEnabled,
	setSessionDefaultProfile,
	setWebEnabled,
} from "../state.js";
import { detectInstalledBrowsers, ENGINES, runBrowserInstall, type Engine } from "./install.js";

interface CommandInvocationLike {
	agent?: { id?: unknown };
	rawInput?: string;
	signal?: AbortSignal;
}

type CommandResult = { kind: "success"; text?: string } | { kind: "error"; text: string };

const ok = (text: string): CommandResult => ({ kind: "success", text });
const fail = (text: string): CommandResult => ({ kind: "error", text });

function currentAgentId(invocation: CommandInvocationLike): string {
	const id = invocation.agent?.id;
	return typeof id === "string" ? id : "default";
}

function profileStateSize(name: string): string {
	try {
		const file = join(profileDir(name), "storage-state.json");
		if (!existsSync(file)) return "no state";
		const bytes = statSync(file).size;
		return bytes === 0 ? "empty" : formatBytes(bytes);
	} catch {
		return "?";
	}
}

function listProfiles(): Array<{ name: string; stateSize: string }> {
	try {
		const dir = browserStateDir();
		if (!existsSync(dir)) return [];
		return readdirSync(dir, { withFileTypes: true })
			.flatMap((entry) =>
				entry.isDirectory() && !entry.name.startsWith(".")
					? [{ name: entry.name, stateSize: profileStateSize(entry.name) }]
					: [],
			)
			.sort((a, b) => a.name.localeCompare(b.name));
	} catch {
		return [];
	}
}

function formatProfileList(profiles: Array<{ name: string; stateSize: string }>): string {
	if (profiles.length === 0) return "No profiles found on disk.";
	const lines = [`Profiles (${profiles.length}):`];
	for (const profile of profiles) {
		lines.push(`  ${getProfileLabel(profile.name)}  (${profile.stateSize})${isSessionProfile(profile.name) ? " 📋" : ""}`);
	}
	return lines.join("\n");
}

function formatStatus(agentId: string): string {
	const web = isWebEnabled(agentId);
	const learn = isLearnEnabled(agentId);
	const active = sessionManager.getActiveSessions();
	const profiles = listProfiles();
	const named = profiles.filter((profile) => !isSessionProfile(profile.name));
	const sessionProfiles = profiles.filter((profile) => isSessionProfile(profile.name));
	const configured = pluginRegistry.getAll().map((plugin) => plugin.name);
	let browsers: Record<Engine, boolean> | undefined;
	try {
		browsers = detectInstalledBrowsers();
	} catch {
		browsers = undefined;
	}

	const lines = [
		`🌐 Browser tools: ${web ? "✅ on" : "❌ off"}  |  📖 Learn mode: ${learn ? "✅ on" : "❌ off"}`,
		"────────────────────────────────────────",
		`Status: ${sessionManager.getStatus()}`,
		`Data dir: ${dataDir()}`,
		`Browsers dir: ${browsersPath()}`,
		`Plugins: ${configured.length > 0 ? configured.join(", ") : "(none)"}`,
	];
	if (browsers) {
		const states = ENGINES.map((engine) => `${engine} ${browsers![engine] ? "✓" : "✗"}`).join(" ");
		const missing = ENGINES.some((engine) => !browsers![engine]);
		lines.push(`Browsers: ${states}${missing ? " (run /web install)" : ""}`);
	}
	lines.push("Use web-fetch for stateless HTTP fetches.");

	if (active.length > 0) {
		lines.push(`Active sessions: ${active.length}`);
		for (const session of active) {
			const symbol = sessionManager.pluginSymbol(session.pluginName);
			let line = `  ${symbol} [${session.pluginName}] ${session.currentUrl || "(pending)"}`;
			if (session.currentTitle) line += ` — ${session.currentTitle}`;
			if (session.profileName) line += ` [profile: ${session.profileName}]`;
			lines.push(line);
		}
	} else {
		lines.push("Active sessions: none");
	}

	if (named.length > 0) {
		const activeProfile = active.find((session) => session.profileName)?.profileName;
		lines.push(`Profiles: ${named.length} on disk (named)`);
		for (const profile of named) {
			lines.push(`  ${profile.name}  (${profile.stateSize})${profile.name === activeProfile ? " ← active" : ""}`);
		}
	} else if (sessionProfiles.length === 0) {
		lines.push("Profiles: none");
	}
	if (sessionProfiles.length > 0) {
		const activeSession = sessionProfiles.some(
			(profile) => profile.name === active.find((session) => session.profileName)?.profileName,
		);
		lines.push(`Session profiles: ${sessionProfiles.length}${activeSession ? " (active)" : ""} (manage with /web profile)`);
	}

	const conversationProfile = getSessionDefaultProfile(agentId);
	lines.push(`Conversation default profile: ${conversationProfile ?? "(config default)"}`);
	return lines.join("\n");
}

async function handleProfile(invocation: CommandInvocationLike, sub: string): Promise<CommandResult> {
	const agentId = currentAgentId(invocation);

	if (sub === "" || sub === "list") return ok(formatProfileList(listProfiles()));

	if (sub === "none") {
		setSessionDefaultProfile(agentId, "none");
		return ok("Default profile set to 'none' (ephemeral, no persistence).");
	}
	if (sub === "session") {
		setSessionDefaultProfile(agentId, "session");
		return ok("Default profile set to 'session' (persists for this conversation).");
	}

	if (sub === "create" || sub.startsWith("create ")) {
		const name = sub === "create" ? "" : sub.slice("create ".length).trim();
		if (!name) {
			return fail(
				"Usage: /web profile create <name>\n" +
					"  Profile names must be alphanumeric, hyphens, and underscores only.\n" +
					"  Reserved names: none, session, create, list, clear, clear-all, prune.",
			);
		}
		try {
			sanitizeProfileName(name);
			mkdirSync(profileDir(name), { recursive: true, mode: 0o700 });
			return ok(`Created profile '${name}'. Use browser-navigate profile="${name}" to start.`);
		} catch (err) {
			return fail(`Invalid profile name: ${err instanceof Error ? err.message : String(err)}`);
		}
	}

	if (sub === "clear" || sub.startsWith("clear ")) {
		const name = sub === "clear" ? "" : sub.slice("clear ".length).trim();
		if (!name) return fail("Usage: /web profile clear <name>");
		try {
			sanitizeProfileName(name);
		} catch (err) {
			return fail(`Invalid profile name: ${err instanceof Error ? err.message : String(err)}`);
		}
		deleteStorageState(name);
		return ok(`Cleared saved state for profile '${name}'.`);
	}

	if (sub === "clear-all" || sub === "clear-all --confirm") {
		if (!sub.endsWith("--confirm")) {
			return fail("⚠ This clears saved state for ALL profiles.\n  Run /web profile clear-all --confirm to proceed.");
		}
		const profiles = listProfiles();
		for (const profile of profiles) deleteStorageState(profile.name);
		return ok(`Cleared ${profiles.length} profile state(s).`);
	}

	if (sub === "prune" || sub === "prune --confirm") {
		const stale = listProfiles().filter((profile) => isSessionProfile(profile.name) && isSessionStale(profile.name));
		if (stale.length === 0) return ok("No stale session profiles to prune.");
		if (!sub.endsWith("--confirm")) {
			return fail(
				`Found ${stale.length} stale session profile(s): ${stale.map((profile) => profile.name).join(", ")}\n` +
					"  Run /web profile prune --confirm to remove them.",
			);
		}
		const result = pruneStaleSessionProfiles();
		return ok(`Removed ${result.pruned.length} stale session profile(s): ${result.pruned.join(", ")}`);
	}

	return fail(
		`Unknown profile sub-command: "${sub}".\n` +
			"Usage: /web profile [list|none|session|create <name>|clear <name>|clear-all --confirm|prune [--confirm]]",
	);
}

async function handleCookies(invocation: CommandInvocationLike, sub: string): Promise<CommandResult> {
	const tid = currentAgentId(invocation);
	if (sub === "" || sub === "list") {
		const result = await router.getCookies(tid);
		if (!result.success) return fail(`Failed to get cookies: ${result.error ?? "unknown error"}`);
		if (result.cookies.length === 0) return ok("No cookies found for the current session.");
		const lines = [`Found ${result.cookies.length} cookie(s):`, ""];
		for (const cookie of result.cookies) {
			const flags = [cookie.httpOnly ? "HttpOnly" : "", cookie.secure ? "Secure" : "", cookie.sameSite || ""]
				.filter(Boolean)
				.join(" ");
			const expires =
				cookie.expires && cookie.expires > 0 ? new Date(cookie.expires * 1000).toISOString() : "Session";
			lines.push(`  ${cookie.name}=${cookie.value.slice(0, 80)}${cookie.value.length > 80 ? "…" : ""}`);
			lines.push(`    Domain: ${cookie.domain ?? "?"}  Path: ${cookie.path ?? "/"}`);
			lines.push(`    Expires: ${expires}  ${flags}`.trimEnd());
			lines.push("");
		}
		return ok(lines.join("\n"));
	}
	if (sub === "clear" || sub === "clear --confirm") {
		if (!sub.endsWith("--confirm")) {
			return fail(
				"⚠ This will clear ALL cookies for the current session.\n  Run /web cookies clear --confirm to proceed.",
			);
		}
		const result = await router.clearCookies(tid);
		if (!result.success) return fail(`Failed to clear cookies: ${result.error ?? "unknown error"}`);
		return ok("Cleared all cookies for the current session.");
	}
	return fail(`Unknown cookies sub-command: "${sub}". Usage: /web cookies [list|clear [--confirm]]`);
}

async function handleInstall(sub: string, signal?: AbortSignal): Promise<CommandResult> {
	const arg = sub.trim().toLowerCase();
	let engines: Engine[];
	if (!arg) {
		engines = [...ENGINES];
	} else if ((ENGINES as readonly string[]).includes(arg)) {
		engines = [arg as Engine];
	} else {
		return fail(`Unknown install sub-command: "${arg}". Usage: /web install [chromium|firefox]`);
	}
	const outcome = await runBrowserInstall(engines, signal);
	return outcome.ok ? ok(outcome.text) : fail(outcome.text);
}

/**
 * Build the `/web` command definition. `ctx` is used only for the optional
 * `agents` service (live session ids for prune).
 */
export function createWebCommand(ctx: {
	get?: (name: string) => unknown;
}): {
	name: string;
	description: string;
	input: { hint: string };
	handler: (invocation: CommandInvocationLike) => Promise<CommandResult>;
} {
	return {
		name: "web",
		description: "Playwright browser tools: toggle, status, browser install, profiles, cookies",
		input: {
			hint: "[on|learn|off|status|install [chromium|firefox]|profile ...|cookies ...]",
		},
		handler: async (invocation) => {
			const decorated = invocation;
			const sub = (invocation.rawInput ?? "").trim();
			const [head, ...rest] = sub.split(/\s+/).filter(Boolean);
			const tail = rest.join(" ");

			switch (head) {
				case undefined:
				case "status":
					return ok(formatStatus(currentAgentId(decorated)));
				case "on":
				case "learn":
				case "off": {
					const agentId = currentAgentId(decorated);
					const wasWeb = isWebEnabled(agentId);
					const wasLearn = isLearnEnabled(agentId);
					if (head === "off") {
						setWebEnabled(agentId, false);
						setLearnEnabled(agentId, false);
					} else {
						setWebEnabled(agentId, true);
						setLearnEnabled(agentId, head === "learn");
					}
					const nowWeb = isWebEnabled(agentId);
					const nowLearn = isLearnEnabled(agentId);
					const changes: string[] = [];
					if (wasWeb !== nowWeb) changes.push(`browser tools ${nowWeb ? "on" : "off"}`);
					if (wasLearn !== nowLearn) changes.push(`learn mode ${nowLearn ? "on" : "off"}`);
					return ok(
						`🌐 Browser tools: ${nowWeb ? "on" : "off"} | 📖 Learn mode: ${nowLearn ? "on" : "off"}` +
							(changes.length > 0 ? ` (${changes.join(", ")})` : " (unchanged)"),
					);
				}
				case "install":
					return handleInstall(tail, invocation.signal);
				case "profile":
					return handleProfile(decorated, tail);
				case "cookies":
					return handleCookies(decorated, tail);
				default:
					return fail(
						`Unknown sub-command: "${head}".\n` +
							"Usage: /web [on|learn|off|status|install [chromium|firefox]|profile ...|cookies ...]",
					);
			}
		},
	};
}
