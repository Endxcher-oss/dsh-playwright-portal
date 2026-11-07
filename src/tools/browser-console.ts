/** browser-console tool — captured console output or page-side JS evaluation. */

import { defineTool } from "@deepseek-ai/dsh-tools";
import * as router from "../core/router.js";
import { TEXT_OUTPUT, renderText, taskIdOfExecution } from "./common.js";

export const browserConsoleTool = defineTool({
	name: "browser-console",
	description:
		"Execute JavaScript in the current page context and see the result, " +
		"or read captured console output (log, warn, error, info). " +
		"Useful for inspecting page state, reading hidden content, or debugging.",
	parameters: {
		expression: {
			type: "string",
			description: "JavaScript expression to evaluate in the page context. If omitted, returns captured console messages.",
		},
		clear: {
			type: "boolean",
			description: "If true, clear the captured console log (no other action)",
		},
	},
	output: { schema: TEXT_OUTPUT, render: renderText },
	async execute(args, exec) {
		const { expression, clear } = args as { expression?: string; clear?: boolean };
		const tid = taskIdOfExecution(exec);

		if (clear) {
			const cleared = await router.clearConsole(tid);
			if (!cleared.success) throw new Error(`Clear console failed: ${cleared.error ?? "unknown error"}`);
			return { text: "Console log cleared." };
		}

		if (expression) {
			const result = await router.evaluate(tid, expression);
			if (!result.success) throw new Error(`Evaluation failed: ${result.error ?? "unknown error"}`);
			let formatted: string;
			if (typeof result.result === "string") formatted = result.result;
			else if (result.result === undefined || result.result === null) formatted = String(result.result);
			else {
				try {
					formatted = JSON.stringify(result.result, null, 2);
				} catch {
					formatted = String(result.result);
				}
			}
			const limit = 10_000;
			if (formatted.length > limit) {
				formatted = formatted.slice(0, limit) + `\n… (truncated, ${formatted.length - limit} more chars)`;
			}
			return { text: formatted || "undefined" };
		}

		const consoleResult = await router.getConsoleMessages(tid);
		if (!consoleResult.success) throw new Error(`Failed to read console: ${consoleResult.error ?? "unknown error"}`);
		if (consoleResult.messages.length === 0) return { text: "No console messages captured." };
		return { text: consoleResult.messages.map((m) => `[${m.type}] ${m.text}`).join("\n") };
	},
});
