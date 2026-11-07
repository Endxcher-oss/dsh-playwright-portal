/** browser-inspect tool — targeted element/text queries without a full snapshot. */

import { defineTool } from "@deepseek-ai/dsh-tools";
import * as router from "../core/router.js";
import { TEXT_OUTPUT, renderText, taskIdOfExecution } from "./common.js";

export const browserInspectTool = defineTool({
	name: "browser-inspect",
	description:
		"Query the current page for specific elements or extract readable text content with @e ref annotations. " +
		"Use for targeted discovery instead of loading full snapshots.",
	parameters: {
		role: { type: "string", description: 'Filter by ARIA role. Comma-separated for multiple. E.g. "link,button"' },
		name: { type: "string", description: "Filter by accessible name (case-insensitive substring match)" },
		ref: { type: "string", description: "Look up a specific @e ref (e.g. 'e5')." },
		subtree: { type: "string", description: "Scope to elements inside a container role. E.g. 'dialog', 'navigation'" },
		text: { type: "boolean", description: "Include text content from the DOM walker with @e ref annotations. Default: false" },
		maxChars: {
			type: "number",
			description:
				'Max output characters. 0 = no limit. Default: ~2500 when omitted. Truncated output shows "… X more chars (use maxChars=0 for full content)"',
		},
		query: {
			type: "string",
			description:
				"Filter extracted text to only include content matching this case-insensitive keyword. Only active when text=true.",
		},
	},
	output: { schema: TEXT_OUTPUT, render: renderText },
	async execute(args, exec) {
		const p = args as Record<string, unknown>;
		const tid = taskIdOfExecution(exec);
		const result = await router.browserInspect(tid, {
			...(p.role === undefined ? {} : { role: p.role as string }),
			...(p.name === undefined ? {} : { name: p.name as string }),
			...(p.ref === undefined ? {} : { ref: p.ref as string }),
			...(p.subtree === undefined ? {} : { subtree: p.subtree as string }),
			...(p.text === undefined ? {} : { text: Boolean(p.text) }),
			...(p.maxChars === undefined ? {} : { maxChars: p.maxChars as number }),
			...(p.query === undefined ? {} : { query: p.query as string }),
		});
		if (!result.success) throw new Error(result.error ?? "browser-inspect failed");
		return { text: result.content };
	},
});
