/**
 * browser-snapshot tool — refresh the accessibility tree.
 */

import { defineTool } from "../define-tool.js";
import * as router from "../core/router.js";
import { getConfig } from "../config.js";
import { TEXT_OUTPUT, joinLines, renderText, taskIdOfExecution } from "./common.js";

export const browserSnapshotTool = defineTool({
	name: "browser-snapshot",
	description:
		"Get the current page's accessibility tree with @e1, @e2 element references. " +
		"Also captures a screenshot file (path is included in the output). " +
		"Use after browser-navigate or after page changes (click, scroll) to refresh the element list.",
	parameters: {
		full: {
			type: "boolean",
			description: "If true, return the complete tree instead of the compact view (default: false)",
		},
	},
	output: { schema: TEXT_OUTPUT, render: renderText },
	async execute(args, exec) {
		const tid = taskIdOfExecution(exec);
		const full = Boolean((args as { full?: boolean }).full);
		const result = await router.snapshot(tid, full);
		if (!result.success) {
			throw new Error(`Snapshot failed: ${result.error ?? "unknown error"}`);
		}
		const screenshotLine = getConfig().screenshot ? await router.captureScreenshotLine(tid) : "";
		return {
			text: joinLines([screenshotLine, result.snapshot || "(empty page)"]),
		};
	},
});
