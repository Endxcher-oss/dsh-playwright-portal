/**
 * Playwright runtime accessor.
 *
 * Loaded through CommonJS `require` rather than the ESM entry. Inside the
 * Harness the ESM path (`playwright/index.mjs` -> `playwright-core` import
 * condition) can run `playwright-core/index.js` through the ESM-to-CJS
 * translator, where `coreBundle.inprocess.playwright` is unset and launch
 * fails with "Cannot read properties of undefined (reading 'playwright')".
 * The CJS path initializes `coreBundle` normally and is identical to how the
 * Playwright CLI loads itself.
 */

import { createRequire } from "node:module";

type PlaywrightModule = typeof import("playwright");

let cached: PlaywrightModule | undefined;

export function playwrightRuntime(): PlaywrightModule {
	if (!cached) {
		const require = createRequire(import.meta.url);
		cached = require("playwright") as PlaywrightModule;
	}
	return cached;
}
