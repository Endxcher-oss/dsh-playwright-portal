/** Tool definitions, in registration order. */

import { webFetchTool } from "./web-fetch.js";
import { browserNavigateTool } from "./browser-navigate.js";
import { browserSnapshotTool } from "./browser-snapshot.js";
import { browserClickTool } from "./browser-click.js";
import { browserTypeTool } from "./browser-type.js";
import { browserScrollTool } from "./browser-scroll.js";
import { browserBackTool } from "./browser-back.js";
import { browserPressTool } from "./browser-press.js";
import { browserConsoleTool } from "./browser-console.js";
import { browserInspectTool } from "./browser-inspect.js";
import { webGuideTool } from "./web-guide.js";
import { webLearnTool } from "./web-learn.js";

/** The whole web tool family (hidden together by `/web off`). */
export const WEB_TOOL_NAMES = new Set([
	"web-fetch",
	"browser-navigate",
	"browser-snapshot",
	"browser-click",
	"browser-type",
	"browser-scroll",
	"browser-back",
	"browser-press",
	"browser-console",
	"browser-inspect",
	"web-guide",
]);

export const toolDefinitions = [
	webFetchTool,
	browserNavigateTool,
	browserSnapshotTool,
	browserClickTool,
	browserTypeTool,
	browserScrollTool,
	browserBackTool,
	browserPressTool,
	browserConsoleTool,
	browserInspectTool,
	webGuideTool,
	webLearnTool,
];
