/** web-guide tool — read navigation guidance for a site or pattern. */

import { defineTool } from "../define-tool.js";
import { formatGuideList, getGuideContent } from "../core/guides.js";
import { TEXT_OUTPUT, renderText } from "./common.js";

export const webGuideTool = defineTool({
	name: "web-guide",
	description:
		"Get navigation guidance for a site or pattern. " +
		"Call with a guide name (e.g. 'reddit', 'cookie-consent', 'bot-detection') " +
		"for guidance, or with no parameter to list all available guides.",
	parameters: {
		guide: {
			type: "string",
			description: "Guide name (e.g. 'reddit', 'cookie-consent', 'bot-detection'). Omit to list all guides.",
		},
	},
	output: { schema: TEXT_OUTPUT, render: renderText },
	async execute(args) {
		const { guide } = args as { guide?: string };
		if (!guide) return { text: formatGuideList() };
		const entry = getGuideContent()[guide];
		if (!entry) {
			return {
				text: `No guide for '${guide}'. Available: ${Object.keys(getGuideContent()).join(", ")}`,
			};
		}
		const currentDate = new Date().toISOString().slice(0, 10);
		return {
			text:
				entry.content +
				`\n\n_Guide updated: ${entry.updated} · Current date: ${currentDate} · Source: ${entry.source}_`,
		};
	},
});
