/**
 * Chromium Plugin — Native Node backend using Playwright Chromium.
 *
 * Thin subclass of PlaywrightPluginBase. All shared logic lives in
 * backends/playwright-base/playwright-plugin.ts.
 *
 * Launches Chromium directly and drives its own page; the plugin is the
 * sole browser owner. No external-attach endpoint is exposed.
 */

import type { Browser } from "playwright";
import { getConfig } from "../../config.js";
import { playwrightRuntime } from "../../playwright-runtime.js";
import { browsersPath } from "../../core/shared/paths.js";
import { PlaywrightPluginBase } from "../playwright-base/playwright-plugin.js";
import { DEFAULT_CAPABILITIES } from "../../core/plugin-api.js";

export class ChromiumPlugin extends PlaywrightPluginBase {
	readonly name = "chromium";
	readonly capabilities = DEFAULT_CAPABILITIES;

	/** Hardcoded Chrome user-agent — no dynamic capture needed. */
	protected get userAgent(): string {
		return "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
	}

	protected async launchBrowser(): Promise<Browser> {
		// Loaded lazily via CommonJS inside the runtime accessor.
		const { chromium } = playwrightRuntime();
		return chromium.launch({
			headless: getConfig().headless,
			args: [
				"--no-sandbox",
				"--disable-setuid-sandbox",
				"--disable-dev-shm-usage",
				"--disable-gpu",
			],
		});
	}

	protected get installHint(): string {
		return `Browser not installed. Run /web install chromium (browsers are written to ${browsersPath()}).`;
	}
}

export default ChromiumPlugin;
