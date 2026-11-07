/**
 * Shared helpers for the DSH tool definitions.
 */

import { taskIdOf } from "../core/shared/task-id.js";

/** DSH author schema for the single-text-block result every tool returns. */
export const TEXT_OUTPUT = {
	type: "object" as const,
	additionalProperties: false as const,
	properties: {
		text: { type: "string" as const, required: true as const },
	},
};

/** Plain text model-facing rendering. */
export function renderText(_args: unknown, value: { text: string }): Array<{ type: "text"; text: string }> {
	return [{ type: "text", text: value.text }];
}

/** Trim trailing/leading blank lines and normalize separators. */
export function joinLines(parts: Array<string | false | undefined | null>): string {
	return parts.filter((part): part is string => Boolean(part)).join("\n");
}

/** Resolve the browser task id for a tool execution. */
export function taskIdOfExecution(exec: unknown): string {
	const agent = (exec as { agent?: { id?: unknown } } | undefined)?.agent;
	return taskIdOf(agent);
}

/** Common shape of router interaction results. */
export interface InteractionLike {
	success: boolean;
	error?: string;
	snapshot?: string;
	elementCount?: number;
	newUrl?: string;
	newTitle?: string;
	dialogEvents?: Array<{ type: string; message: string; handledAs?: string }>;
}

/**
 * Run one ref-based interaction and append the auto-captured snapshot,
 * mirroring the Pi tool wrapper.
 */
export async function runInteraction(
	exec: { signal?: AbortSignal } | undefined,
	actionName: string,
	run: (taskId: string) => Promise<InteractionLike>,
	message: (result: InteractionLike) => string,
): Promise<{ text: string }> {
	const tid = taskIdOfExecution(exec);
	const result = await run(tid);
	if (!result.success) {
		throw new Error(`${actionName} failed: ${result.error ?? "unknown error"}`);
	}
	let text = message(result);
	if (result.snapshot) text += `\n\n${result.snapshot}`;
	return { text };
}
