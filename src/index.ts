/**
 * playwright-portal — DeepSeek Harness Host plugin.
 *
 * Port of the Pi extension `pi-lean-portal@0.7.2`: Playwright-driven
 * interactive browsing with accessibility-tree snapshots (`@e` refs),
 * persistent profiles/cookies, navigation guides, bot detection, and
 * per-session tool visibility (`/web`).
 *
 * All persistent state lives under `<DSH_HOME>/playwright` by default
 * (configurable via the row's `dataDir`).
 */

import { ChromiumPlugin } from "./backends/chromium/index.js";
import { FirefoxPlugin } from "./backends/firefox/index.js";
import { pluginRegistry } from "./core/plugin-registry.js";
import { sessionManager } from "./core/shared/session-manager.js";
import { configure, getConfig } from "./config.js";
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { configurePaths, dataDir, ensureDir } from "./core/shared/paths.js";
import { cleanupFetchTempFiles } from "./core/fetch-backend.js";
import { removeAllSnapshotFiles, removeSnapshotFiles } from "./core/shared/snapshot-cache.js";
import { toolDefinitions } from "./tools/index.js";
import { createWebCommand } from "./commands/web.js";
import { flushToggleState, forgetSession, isLearnEnabled, isWebEnabled, loadToggleState } from "./state.js";

export const name = "playwright-portal";
export const inject = ["tools"];

interface LoggerLike {
	info?: (message: string) => void;
	warn?: (message: string) => void;
	error?: (message: string) => void;
}

interface AgentLike {
	id: string;
}

interface ApplyContextLike {
	effect?: (factory: () => () => void) => void;
	on?: (event: string, listener: (payload: { agent: AgentLike }) => void) => void;
	logger?: LoggerLike;
	get?: (service: string) => unknown;
	inject?: (services: string[], callback: (ctx: ApplyContextLike) => void) => void;
}

function registerBackends(logger?: LoggerLike): void {
	pluginRegistry.clear();
	const engines = getConfig().engines;
	pluginRegistry.seedOrder(engines);
	for (const engine of engines) {
		const plugin = engine === "firefox" ? new FirefoxPlugin() : new ChromiumPlugin();
		try {
			pluginRegistry.register(plugin, { name: engine, enabled: true });
			void Promise.resolve(plugin.init?.()).catch((err: unknown) => {
				logger?.warn?.(`[playwright-portal] ${engine} init failed: ${err instanceof Error ? err.message : String(err)}`);
			});
		} catch (err) {
			logger?.error?.(
				`[playwright-portal] could not register ${engine}: ${err instanceof Error ? err.message : String(err)}`,
			);
		}
	}
}

export function apply(ctx: ApplyContextLike, rawConfig?: unknown): void {
	const { warnings } = configure(rawConfig);
	configurePaths();
	for (const warning of warnings) ctx.logger?.warn?.(`[playwright-portal] config: ${warning}`);

	// Every Playwright consumer in this process resolves browser binaries here.
	const previousBrowsersPath = process.env.PLAYWRIGHT_BROWSERS_PATH;
	process.env.PLAYWRIGHT_BROWSERS_PATH = getConfig().browsersPath;
	ensureDir(dataDir());
	try { // TEMP_DIAG
		const req = createRequire(import.meta.url);
		const one = (spec: string) => { try { return req.resolve(spec); } catch (e) { return `ERR ${(e as Error).message}`; } };
		writeFileSync(join(dataDir(), "diag2.json"), JSON.stringify({
			execPath: process.execPath, argv0: process.argv[0], node: process.versions.node,
			importMetaUrl: import.meta.url,
			playwright: one("playwright"), playwrightCore: one("playwright-core"),
			esmPlaywright: (() => { try { return import.meta.resolve?.("playwright"); } catch (e) { return `ERR ${(e as Error).message}`; } })(),
			nodeOptions: process.env.NODE_OPTIONS, pwNodePath: process.env.PLAYWRIGHT_NODEJS_PATH,
		}, null, 2));
	} catch {}
	for (const warning of loadToggleState()) ctx.logger?.warn?.(`[playwright-portal] ${warning}`);

	registerBackends(ctx.logger);

	const disposers: Array<() => void> = [];
	const tools = ctx.inject;
	if (typeof tools === "function") {
		ctx.inject!(["tools"], (toolsCtx) => {
			const toolsService = (toolsCtx as unknown as {
				tools?: { register(def: unknown, options: unknown): () => void };
			}).tools;
			if (!toolsService) {
				ctx.logger?.error?.("[playwright-portal] tools service unavailable");
				return;
			}
			for (const definition of toolDefinitions) {
				const learn = definition.name === "web-learn";
				const dispose = toolsService.register(definition, {
					when: ({ agent }: { agent: AgentLike }) => {
						const sessionId = String(agent.id);
						return learn ? isWebEnabled(sessionId) && isLearnEnabled(sessionId) : isWebEnabled(sessionId);
					},
				});
				disposers.push(dispose);
			}
		});

		ctx.inject!(["commands"], (commandCtx) => {
			const commandsService = (commandCtx as unknown as {
				commands?: { register(def: unknown): () => void };
			}).commands;
			if (!commandsService) return;
			disposers.push(commandsService.register(createWebCommand(ctx)));
		});
	}

	ctx.on?.("agent/disposed", ({ agent }) => {
		const sessionId = String(agent.id);
		for (const plugin of pluginRegistry.getAll()) {
			void plugin.cleanup(sessionId).catch(() => {});
		}
		sessionManager.removeSession(sessionId);
		removeSnapshotFiles(sessionId);
		cleanupFetchTempFiles(sessionId);
		forgetSession(sessionId);
	});

	ctx.effect?.(() => () => {
		for (const dispose of disposers) {
			try {
				dispose();
			} catch {
				/* already disposed */
			}
		}
		flushToggleState();
		if (previousBrowsersPath === undefined) delete process.env.PLAYWRIGHT_BROWSERS_PATH;
		else process.env.PLAYWRIGHT_BROWSERS_PATH = previousBrowsersPath;
		for (const plugin of pluginRegistry.getAll()) {
			void plugin.cleanupAll().catch(() => {});
		}
		pluginRegistry.clear();
		sessionManager.removeAll();
		removeAllSnapshotFiles();
	});

	ctx.logger?.info?.(
		`[playwright-portal] ready (engines: ${getConfig().engines.join(", ")}; data: ${getConfig().dataDir}; browsers: ${getConfig().browsersPath})`,
	);
}

export default apply;
