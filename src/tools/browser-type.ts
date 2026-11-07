/** browser-type tool — type text into an @e ref. */

import { defineTool } from "@deepseek-ai/dsh-tools";
import * as router from "../core/router.js";
import { TEXT_OUTPUT, joinLines, renderText, runInteraction } from "./common.js";

export const browserTypeTool = defineTool({
	name: "browser-type",
	description:
		"Type text into an input, textarea, or editable element identified by an @e reference. " +
		"Clears the field first, then types. Elements the page marks as readonly/disabled fail.",
	parameters: {
		ref: { type: "string", description: "Element reference like @e5", required: true },
		text: { type: "string", description: "Text to type into the element", required: true },
	},
	output: { schema: TEXT_OUTPUT, render: renderText },
	async execute(args, exec) {
		const { ref, text } = args as { ref: string; text: string };
		return runInteraction(
			exec,
			"Type",
			(tid) => router.type(tid, ref, text),
			(result) =>
				joinLines([
					`Typed into ${ref}`,
					result.newUrl ? `URL: ${result.newUrl}` : "",
					result.newTitle ? `Title: ${result.newTitle}` : "",
				]),
		);
	},
});
