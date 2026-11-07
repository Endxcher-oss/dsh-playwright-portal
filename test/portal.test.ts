import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { configure, getConfig } from "../src/config.js";
import { configurePaths, artifactsDir, browserStateDir, dataDir, guidesDir } from "../src/core/shared/paths.js";
import {
	deleteStorageState,
	isSessionStale,
	loadStorageState,
	profileDir,
	pruneStaleSessionProfiles,
	sanitizeProfileName,
	saveStorageState,
	sessionProfileName,
} from "../src/core/shared/storage-state.js";
import { cacheSnapshot, removeSnapshotFiles } from "../src/core/shared/snapshot-cache.js";
import { parseSnapshot } from "../src/core/shared/accessibility-tree.js";
import { getGuideContent, resolveApplicableGuides } from "../src/core/guides.js";
import {
	flushToggleState,
	isLearnEnabled,
	isWebEnabled,
	loadToggleState,
	resetToggleStateForTests,
	setLearnEnabled,
	setWebEnabled,
} from "../src/state.js";
import { toolDefinitions, WEB_TOOL_NAMES } from "../src/tools/index.js";
import { webLearnTool } from "../src/tools/web-learn.js";
import { createWebCommand } from "../src/commands/web.js";
import { detectInstalledBrowsers, resolveBundledPlaywright } from "../src/commands/install.js";

const cleanups: string[] = [];

function freshRoot(): string {
	const root = mkdtempSync(join(tmpdir(), "playwright-portal-test-"));
	cleanups.push(root);
	process.env.DSH_HOME = root;
	configure({ dataDir: join(root, "playwright") });
	configurePaths();
	resetToggleStateForTests();
	return root;
}

test.after(() => {
	for (const dir of cleanups) rmSync(dir, { recursive: true, force: true });
});

test("config defaults place every path under $DSH_HOME/playwright", () => {
	const root = freshRoot();
	const config = getConfig();
	assert.equal(config.dataDir, join(root, "playwright"));
	assert.equal(config.browsersPath, join(config.dataDir, "browsers"));
	assert.equal(dataDir(), config.dataDir);
	assert.equal(browserStateDir(), join(config.dataDir, "browser-state"));
	assert.equal(guidesDir(), join(config.dataDir, "web-guides"));
	assert.equal(artifactsDir(), join(config.dataDir, "artifacts"));
	assert.deepEqual(config.engines, ["chromium", "firefox"]);
	assert.equal(config.headless, true);
	assert.equal(config.defaultProfile, "session");
	assert.equal(config.screenshotFullPage, false);
	assert.equal(config.screenshot, true);
	assert.equal(config.screenshotFullPage, false);
});

test("config validation rejects bad values and keeps defaults", () => {
	freshRoot();
	const { warnings } = configure({
		dataDir: "relative/path",
		engines: ["chromium", "webkit", "chromium"],
		maxStorageStateSize: -1,
		timeoutSeconds: 999,
		defaultProfile: "bad name!",
		screenshotFullPage: "yes",
	});
	const config = getConfig();
	assert.equal(config.dataDir, join(process.env.DSH_HOME!, "playwright"));
	assert.deepEqual(config.engines, ["chromium"]);
	assert.equal(config.maxStorageStateSize, 10 * 1024 * 1024);
	assert.equal(config.timeoutSeconds, 30);
	assert.equal(config.defaultProfile, "session");
	assert.equal(config.screenshotFullPage, false);
	assert.ok(warnings.some((warning) => warning.includes("dataDir")));
	assert.ok(warnings.some((warning) => warning.includes("engines")));
	assert.ok(warnings.some((warning) => warning.includes("maxStorageStateSize")));
});

test("profile names are sanitized and stored under the portal data dir", () => {
	freshRoot();
	assert.equal(sanitizeProfileName("work-1"), "work-1");
	assert.throws(() => sanitizeProfileName("../escape"));
	assert.throws(() => sanitizeProfileName("session"));
	assert.equal(profileDir("work"), join(browserStateDir(), "work"));
	assert.equal(sessionProfileName("session-abc"), "_session-session-abc");
});

test("storage state round-trips, merges cookies, and uses 0600", () => {
	freshRoot();
	const first = { cookies: [{ name: "a", value: "1", domain: "example.com", path: "/" }], origins: [] };
	assert.equal(saveStorageState("work", first as never), true);
	const second = { cookies: [{ name: "b", value: "2", domain: "example.com", path: "/" }], origins: [] };
	assert.equal(saveStorageState("work", second as never), true);
	const loaded = loadStorageState("work");
	assert.ok(loaded);
	assert.deepEqual(
		loaded!.cookies.map((cookie) => cookie.name).sort(),
		["a", "b"],
		"cookies from concurrent writers are merged",
	);
	const file = join(profileDir("work"), "storage-state.json");
	assert.equal(statSync(file).mode & 0o777, 0o600);
	assert.equal(statSync(profileDir("work")).mode & 0o777, 0o700);
});

test("snapshot cache writes under the artifacts dir and cleans up", () => {
	freshRoot();
	const full = "- main:\n" + "  - button \"Submit\"\n".repeat(200);
	const cached = cacheSnapshot("session-test", full, "fp");
	assert.ok(cached);
	assert.equal(cached!.path.startsWith(artifactsDir()), true);
	assert.equal(readFileSync(cached!.path, "utf-8"), full);
	removeSnapshotFiles("session-test");
	assert.equal(existsSync(cached!.path), false);
});

test("accessibility parser assigns @e refs and caches nodes", () => {
	const parsed = parseSnapshot('- main:\n  - button "Submit"\n  - link "Home"\n  - textbox "Email"\n');
	assert.equal(parsed.count, 3);
	assert.ok(parsed.text.includes("@e1"));
	assert.equal(parsed.elements.get("e1")!.role, "button");
	assert.equal(parsed.elements.get("e2")!.name, "Home");
});

test("builtin guides resolve by domain and trigger signal", () => {
	freshRoot();
	const bot = resolveApplicableGuides("https://example.com", false, true);
	assert.ok(bot.some((guide) => guide.name === "bot-detection"));
	const consent = resolveApplicableGuides("https://example.com", true, false);
	assert.ok(consent.some((guide) => guide.name === "cookie-consent"));
	const plain = resolveApplicableGuides("https://example.com", false, false);
	assert.equal(plain.length, 0);
});

test("toggle state persists per session under the data dir", () => {
	freshRoot();
	assert.equal(isWebEnabled("session-a"), true);
	assert.equal(isLearnEnabled("session-a"), false);
	setWebEnabled("session-a", false);
	setLearnEnabled("session-a", true);
	flushToggleState();
	const file = join(dataDir(), "state.json");
	assert.equal(existsSync(file), true);
	assert.equal(statSync(file).mode & 0o777, 0o600);
	resetToggleStateForTests();
	assert.deepEqual(loadToggleState(), []);
	assert.equal(isWebEnabled("session-a"), false);
	assert.equal(isLearnEnabled("session-a"), true);
});

test("all twelve tools keep the upstream names", () => {
	assert.deepEqual(
		toolDefinitions.map((tool) => tool.name),
		[
			"web-fetch",
			"browser-navigate",
			"browser-snapshot",
			"browser-click",
			"browser-type",
			"browser-scroll",
			"browser-back",
			"browser-press",
			"browser-console",
			"browser-inspect",
			"web-guide",
			"web-learn",
		],
	);
	assert.equal(WEB_TOOL_NAMES.has("web-learn"), false, "learn is gated separately");
	for (const tool of toolDefinitions) {
		assert.equal(tool.output.schema.type, "object");
		assert.deepEqual(tool.output.schema.required, ["text"]);
		assert.equal(tool.output.schema.properties.text.type, "string");
	}
});


test("/web command reports the .dsh data dir and toggles session state", async () => {
	const root = freshRoot();
	const command = createWebCommand({ get: () => undefined });

	const status = await command.handler({ agent: { id: "session-cmd" }, rawInput: "" });
	assert.equal(status.kind, "success");
	assert.match(String(status.text), new RegExp(`Data dir: ${join(root, "playwright").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));

	const off = await command.handler({ agent: { id: "session-cmd" }, rawInput: "off" });
	assert.equal(off.kind, "success");
	assert.equal(isWebEnabled("session-cmd"), false);

	const learn = await command.handler({ agent: { id: "session-cmd" }, rawInput: "learn" });
	assert.equal(learn.kind, "success");
	assert.equal(isWebEnabled("session-cmd"), true);
	assert.equal(isLearnEnabled("session-cmd"), true);

	const created = await command.handler({ agent: { id: "session-cmd" }, rawInput: "profile create work" });
	assert.equal(created.kind, "success");
	assert.equal(existsSync(profileDir("work")), true);

	const badInstall = await command.handler({ agent: { id: "session-cmd" }, rawInput: "install netscape" });
	assert.equal(badInstall.kind, "error");
});


test("stale session profiles are pruned using the DSH session store", () => {
	const root = freshRoot();
	saveStorageState(sessionProfileName("session-live"), { cookies: [], origins: [] } as never);
	saveStorageState(sessionProfileName("session-dead"), { cookies: [], origins: [] } as never);
	mkdirSync(join(root, "sessions", "--cwd--", "session-live"), { recursive: true });

	assert.equal(isSessionStale(sessionProfileName("session-live")), false);
	assert.equal(isSessionStale(sessionProfileName("session-dead")), true);

	const result = pruneStaleSessionProfiles();
	assert.deepEqual(result.pruned, [sessionProfileName("session-dead")]);
	assert.equal(existsSync(profileDir(sessionProfileName("session-live"))), true);

	deleteStorageState(sessionProfileName("session-live"));
	assert.equal(existsSync(profileDir(sessionProfileName("session-live"))), false);
});


test("web-learn is gated by learn mode and writes into <dataDir>/web-guides", async () => {
	freshRoot();
	const exec = { agent: { id: "session-learn" }, signal: new AbortController().signal };
	const guideText = "Use the search box, then open the first result. Consent dialog appears on first visit.";

	await assert.rejects(
		() => (webLearnTool as { execute: (args: unknown, exec: unknown) => Promise<unknown> }).execute(
			{ domain: "example.org", content: guideText },
			exec,
		),
		/learn mode is off/i,
	);

	setLearnEnabled("session-learn", true);
	const result = (await (webLearnTool as { execute: (args: unknown, exec: unknown) => Promise<{ text: string }> }).execute(
		{ domain: "example.org", content: guideText },
		exec,
	)) as { text: string };
	assert.match(result.text, /Created guide at/);
	assert.equal(existsSync(join(guidesDir(), "example.org.md")), true);
	const guide = getGuideContent()["example.org"];
	assert.ok(guide);
	assert.deepEqual(guide!.domains, ["example.org"]);
	assert.equal(guide!.source, "user");
});


test("/web install resolves the bundled Playwright CLI", () => {
	freshRoot();
	const bundled = resolveBundledPlaywright();
	assert.equal(existsSync(bundled.cliJs), true);
	assert.match(bundled.cliJs, /playwright[/\\]cli\.js$/);
	assert.deepEqual(detectInstalledBrowsers(), { chromium: false, firefox: false });
});


test("screenshotFullPage is configurable and exposed on screenshot-capturing tools", () => {
	freshRoot();
	configure({ screenshotFullPage: true });
	assert.equal(getConfig().screenshotFullPage, true);

	const navigate = toolDefinitions.find((tool) => tool.name === "browser-navigate") as any;
	const snapshot = toolDefinitions.find((tool) => tool.name === "browser-snapshot") as any;
	assert.equal(navigate.parameters.properties.screenshotFullPage.type, "boolean");
	assert.equal(snapshot.parameters.properties.screenshotFullPage.type, "boolean");
});
