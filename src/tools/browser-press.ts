/** browser-press tool — keyboard key press. */

import { defineTool } from "../define-tool.js";
import * as router from "../core/router.js";
import { TEXT_OUTPUT, joinLines, renderText, runInteraction } from "./common.js";

export const browserPressTool = defineTool({
	name: "browser-press",
	description:
		"Press a keyboard key on the focused element (e.g. Enter, Tab, Escape, ArrowDown, Backspace).",
	parameters: {
		key: {
			type: "string",
			description: "Key to press (e.g., 'Enter', 'Tab', 'Escape', 'ArrowDown', 'ArrowUp')",
			required: true,
		},
	},
	output: { schema: TEXT_OUTPUT, render: renderText },
	async execute(args, exec) {
		const { key } = args as { key: string };
		return runInteraction(
			exec,
			"Press",
			(tid) => router.press(tid, key),
			(result) =>
				joinLines([
					`Pressed "${key}"`,
					result.newUrl ? `URL: ${result.newUrl}` : "",
					result.newTitle ? `Title: ${result.newTitle}` : "",
				]),
		);
	},
});
