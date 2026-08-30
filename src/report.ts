import { type Match, MEANING } from "./check.js";

/**
 * Hidden tag on our own comment. A thread can be re-checked many times — every
 * new comment on it fires the workflow again — and the reviewer should end up
 * with one note that stays current, not a pile of identical ones.
 */
export const MARKER = "<!-- typosquat -->";

/** Reads as a note to the reviewer, not a verdict on the author. */
export function buildComment(author: string, result: Match): string {
	return [
		MARKER,
		`### Lookalike username: \`${author}\``,
		"",
		`\`${author}\` looks like \`${result.resembles}\` (${result.reason}).`,
		"",
		`**${result.severity.toUpperCase()}** — ${MEANING[result.severity]}`,
	].join("\n");
}
