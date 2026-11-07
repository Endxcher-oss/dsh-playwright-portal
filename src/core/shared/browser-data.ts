/**
 * Shared browser data (bot-detection signals, accessibility roles/icons,
 * nav-settle constants) as a typed module.
 *
 * Upstream Pi keeps this in browser-data.json so the TypeScript and Python
 * bridges share one source. The Python bridges are not part of this port, so
 * the data is inlined here and JSON import attributes stay out of the bundle.
 */

export interface BotSignals {
	blockSignals: string[];
	bodyOnlySignals: string[];
	bodyOnlyPatterns: string[];
	htmlSignals: string[];
}

export interface AccessibilityData {
	interactiveRoles: string[];
	informationalRoles: string[];
	roleIcons: Record<string, string>;
}

export interface NavSettleData {
	navTimeoutMs: number;
	settleTimeoutMs: number;
	settleRaceMs: number;
	domStabilizationJs: string;
}

export interface BrowserDataFile {
	version: number;
	botSignals: BotSignals;
	accessibility: AccessibilityData;
	navSettle: NavSettleData;
}

const data: BrowserDataFile = {
	"version": 1,
	"botSignals": {
		"blockSignals": [
			"please verify you are human",
			"attention required!",
			"just a moment...",
			"checking your browser",
			"you have been blocked",
			"sorry, you have been blocked",
			"verify you are human",
			"your request has been blocked",
			"we are checking your browser",
			"cf-challenge",
			"_cf_chl_opt",
			"cdn-cgi/challenge"
		],
		"bodyOnlySignals": [
			"errors.edgesuite.net",
			"you don't have permission to access"
		],
		"bodyOnlyPatterns": [
			"reference\\s*#[a-f0-9]+(?:\\.[a-f0-9]+)+"
		],
		"htmlSignals": [
			"recaptcha",
			"hcaptcha",
			"turnstile",
			"g-recaptcha",
			"data-sitekey"
		]
	},
	"accessibility": {
		"interactiveRoles": [
			"button",
			"link",
			"textbox",
			"searchbox",
			"combobox",
			"checkbox",
			"radio",
			"heading",
			"listbox",
			"option",
			"menuitem",
			"menuitemcheckbox",
			"menuitemradio",
			"tab",
			"treeitem",
			"switch",
			"slider",
			"spinbutton",
			"progressbar",
			"meter",
			"scrollbar",
			"gridcell",
			"cell",
			"columnheader",
			"rowheader",
			"tabpanel",
			"img",
			"figure",
			"listitem",
			"dialog",
			"alertdialog",
			"tooltip",
			"navigation",
			"banner",
			"form",
			"search",
			"toolbar",
			"menu",
			"menubar",
			"note",
			"alert",
			"status",
			"list",
			"table",
			"grid",
			"treegrid",
			"article",
			"section",
			"blockquote",
			"code"
		],
		"informationalRoles": [
			"paragraph",
			"text",
			"group",
			"region",
			"main",
			"complementary",
			"contentinfo",
			"definition",
			"term",
			"math",
			"marquee",
			"timer",
			"log",
			"deletion",
			"insertion",
			"mark",
			"suggestion",
			"comment"
		],
		"roleIcons": {
			"alert": "🔔 ",
			"alertdialog": "⚠ ",
			"article": "📰 ",
			"banner": "📰 ",
			"blockquote": "💬 ",
			"button": "🔘 ",
			"cell": "▫ ",
			"checkbox": "☑ ",
			"code": "💻 ",
			"columnheader": "📊 ",
			"combobox": "📋 ",
			"comment": "💬 ",
			"complementary": "📎 ",
			"contentinfo": "ℹ ",
			"definition": "📖 ",
			"deletion": "❌ ",
			"dialog": "💬 ",
			"figure": "🖼 ",
			"form": "📝 ",
			"grid": "📊 ",
			"gridcell": "▫ ",
			"group": "📦 ",
			"heading": "📌 ",
			"img": "🖼 ",
			"insertion": "➕ ",
			"link": "🔗 ",
			"list": "📋 ",
			"listbox": "📋 ",
			"listitem": "• ",
			"log": "📋 ",
			"main": "📄 ",
			"mark": "🖍️ ",
			"marquee": "📜 ",
			"math": "🧮 ",
			"menu": "📋 ",
			"menubar": "📋 ",
			"menuitem": "📋 ",
			"menuitemcheckbox": "☑ ",
			"menuitemradio": "○ ",
			"meter": "📊 ",
			"navigation": "🧭 ",
			"note": "📝 ",
			"option": "• ",
			"paragraph": "📃 ",
			"progressbar": "⏳ ",
			"radio": "○ ",
			"region": "📦 ",
			"rowheader": "📊 ",
			"search": "🔍 ",
			"searchbox": "🔍 ",
			"scrollbar": "📜 ",
			"section": "📄 ",
			"slider": "🔧 ",
			"spinbutton": "🔢 ",
			"status": "📊 ",
			"suggestion": "💡 ",
			"switch": "🔀 ",
			"tab": "📑 ",
			"table": "📊 ",
			"tabpanel": "📑 ",
			"term": "📖 ",
			"text": "📝 ",
			"textbox": "📝 ",
			"timer": "⏱️ ",
			"toolbar": "🔧 ",
			"tooltip": "💡 ",
			"treegrid": "📊 ",
			"treeitem": "• "
		}
	},
	"navSettle": {
		"navTimeoutMs": 5000,
		"settleTimeoutMs": 400,
		"settleRaceMs": 150,
		"domStabilizationJs": "new Promise((resolve) => {\n    const count = document.querySelectorAll(\"*\").length;\n    setTimeout(() => {\n        resolve(document.querySelectorAll(\"*\").length === count || count > 5000);\n    }, 400);\n})"
	}
};

export const BOT_SIGNALS: BotSignals = data.botSignals;
export const ACCESSIBILITY: AccessibilityData = data.accessibility;
export const NAV_SETTLE: NavSettleData = data.navSettle;
