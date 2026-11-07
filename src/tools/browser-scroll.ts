/** browser-scroll tool — scroll the page up or down. */

import { defineTool } from "@deepseek-ai/dsh-tools";
import * as router from "../core/router.js";
import { TEXT_OUTPUT, renderText, runInteraction } from "./common.js";

export const browserScrollTool = defineTool({
	name: "browser-scroll",
	description: "Scroll the page one viewport up or down, then return a fresh snapshot.",
	parameters: {
		direction: {
			type: "string",
			enum: ["up", "down"],
			description: "Scroll direction",
			required: true,
		},
	},
	output: { schema: TEXT_OUTPUT, render: renderText },
	async execute(args, exec) {
		const { direction } = args as { direction: "up" | "down" };
		return runInteraction(exec, "Scroll", (tid) => router.scroll(tid, direction), () => `Scrolled ${direction}`);
	},
});
