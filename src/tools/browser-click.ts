/** browser-click tool — click an element by @e ref. */

import { defineTool } from "@deepseek-ai/dsh-tools";
import * as router from "../core/router.js";
import { TEXT_OUTPUT, joinLines, renderText, runInteraction } from "./common.js";

export const browserClickTool = defineTool({
	name: "browser-click",
	description:
		"Click an element on the page by its @e reference ID (e.g. @e5). " +
		"Use element references from browser-navigate or browser-snapshot output.",
	parameters: {
		ref: {
			type: "string",
			description: "Element reference like @e5 (from the accessibility tree)",
			required: true,
		},
	},
	output: { schema: TEXT_OUTPUT, render: renderText },
	async execute(args, exec) {
		const { ref } = args as { ref: string };
		return runInteraction(
			exec,
			"Click",
			(tid) => router.click(tid, ref),
			(result) =>
				joinLines([
					`Clicked ${ref}`,
					result.newUrl ? `URL: ${result.newUrl}` : "",
					result.newTitle ? `Title: ${result.newTitle}` : "",
				]),
		);
	},
});
