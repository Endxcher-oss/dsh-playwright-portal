/**
 * Task ID resolution — DSH session id → browser task id.
 *
 * The Pi extension mapped conversation ids to `browser-N` keys. DSH session
 * ids (`session-<uuid>`) are already stable and filename-safe, so the task id
 * is simply the session id; every tool call from one session shares one
 * browser session, and subagents get their own.
 */

/** Extract a stable, filename-safe task id from a DSH agent-like value. */
export function taskIdOf(
	agent: { id?: unknown } | undefined,
	fallback = "default",
): string {
	const id = agent?.id;
	return typeof id === "string" && id.length > 0 ? id : fallback;
}
