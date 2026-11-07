/** web-learn tool — save or update a site navigation guide. */

import { defineTool } from "../define-tool.js";
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ensureGuidesDir } from "../core/shared/paths.js";
import { userGuidesDir } from "../core/guides.js";
import { isLearnEnabled } from "../state.js";
import { TEXT_OUTPUT, renderText, taskIdOfExecution } from "./common.js";

export const webLearnTool = defineTool({
	name: "web-learn",
	description:
		"Save or update a navigation guide for a site. " +
		"Creates a new guide file for the given domain, or updates an existing one with new content and date. " +
		"The guide becomes available immediately via web-guide and appears in the guide footer on future navigations. " +
		"Requires /web learn to be active.",
	parameters: {
		domain: { type: "string", description: "Primary domain (e.g. 'reddit.com'). Used as the filename.", required: true },
		content: {
			type: "string",
			description:
				"Markdown guidance content describing the site's navigation patterns, page structure, consent dialogs, and known quirks.",
			required: true,
		},
		domains: {
			type: "string",
			description:
				"Comma-separated additional domains (e.g. 'www.reddit.com, old.reddit.com'). Omit if only the primary domain applies.",
		},
	},
	output: { schema: TEXT_OUTPUT, render: renderText },
	async execute(args, exec) {
		const { domain, content, domains } = args as { domain: string; content: string; domains?: string };
		if (!isLearnEnabled(taskIdOfExecution(exec))) {
			throw new Error("Learn mode is off. Run /web learn to enable guide saving, then retry.");
		}
		if (!domain.includes(".")) {
			throw new Error(`'${domain}' doesn't look like a domain. Use the full domain (e.g. 'reddit.com').`);
		}
		if (!content || content.trim().length < 20) {
			throw new Error("Content too short. Provide at least a few sentences of guidance.");
		}

		ensureGuidesDir();
		const filename = `${domain}.md`;
		const filepath = join(userGuidesDir(), filename);

		const today = new Date().toISOString().slice(0, 10);
		const allDomains = [domain];
		for (const d of (domains ?? "")
			.split(",")
			.map((s) => s.trim())
			.filter(Boolean)) {
			if (!allDomains.includes(d)) allDomains.push(d);
		}

		const frontmatter = ["---", "category: site", `domains: ${allDomains.join(", ")}`, `updated: ${today}`, "---"].join("\n");
		const isUpdate = existsSync(filepath);
		writeFileSync(filepath, frontmatter + "\n\n" + content.trim() + "\n", { mode: 0o600 });

		return {
			text:
				`📖 ${isUpdate ? "Updated" : "Created"} guide at ${filepath}\n` +
				`  Domains: ${allDomains.join(", ")}\n` +
				`  Call web-guide guide="${domain}" to view it.\n` +
				`  A guide badge and footer will appear when navigating to ${allDomains[0]}.`,
		};
	},
});
