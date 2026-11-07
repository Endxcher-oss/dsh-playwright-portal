/** browser-back tool — browser history back. */

import { defineTool } from "../define-tool.js";
import * as router from "../core/router.js";
import { TEXT_OUTPUT, renderText, runInteraction } from "./common.js";

export const browserBackTool = defineTool({
	name: "browser-back",
	description: "Go back one page in the browser history, then return a fresh snapshot.",
	parameters: {},
	output: { schema: TEXT_OUTPUT, render: renderText },
	async execute(_args, exec) {
		return runInteraction(exec, "Go back", (tid) => router.goBack(tid), (result) => `Went back to: ${result.newUrl || "?"}`);
	},
});
