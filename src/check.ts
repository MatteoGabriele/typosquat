import { isSwap, osaDistance } from "./distance.js";
import {
	botBase,
	digraphFold,
	foldLeet,
	foldRepeats,
	foldSeparators,
	stripBotAffix,
} from "./text.js";

export type Severity = "none" | "low" | "medium" | "high" | "critical";

export type FailOn = Severity | "never";
export interface Protected {
	login: string;
	isBot: boolean;
}

export interface Match {
	rule: string;
	score: number;
	severity: Severity;
	/** The protected login the author resembles. */
	resembles: string;
	reason: string;
}

export const SEVERITIES: readonly Severity[] = [
	"none",
	"low",
	"medium",
	"high",
	"critical",
];

const BANDS: ReadonlyArray<readonly [number, Severity]> = [
	[80, "critical"],
	[60, "high"],
	[40, "medium"],
	[20, "low"],
];

export function severityOf(score: number): Severity {
	for (const [min, name] of BANDS) if (score >= min) return name;
	return "none";
}

export function atLeast(severity: Severity, minimum: Severity): boolean {
	return SEVERITIES.indexOf(severity) >= SEVERITIES.indexOf(minimum);
}

export const isBotLogin = (login: string): boolean =>
	/\[bot\]$/i.test(login) || /(?:^|[-_])bot$/i.test(login);

/** Rules against one protected login, most specific first. First hit wins. */
function match(
	login: string,
	target: Protected,
): Omit<Match, "severity"> | null {
	const base = botBase(target.login);
	if (base.length < 4) {
		return null;
	}

	const a = login.toLowerCase();
	const b = base.toLowerCase();
	if (a === b && !target.isBot) {
		return null;
	}

	const hit = (rule: string, score: number, reason: string) => ({
		rule,
		score,
		resembles: target.login,
		reason,
	});

	if (a === b) {
		// A login cannot contain "[" or "]", so the bare stem of a GitHub App is
		// always a separate, human-registered account.
		return hit(
			"bot-base-name-squat",
			88,
			`login is the bare name of the GitHub App ${target.login}`,
		);
	}

	const aSep = foldSeparators(a);
	const bSep = foldSeparators(b);

	if (target.isBot && foldSeparators(stripBotAffix(a)) === bSep) {
		return hit("bot-affix-variant", 82, `hand-made variant of ${target.login}`);
	}

	if (foldLeet(a) === foldLeet(b) && aSep !== bSep) {
		return hit(
			"digit-substitution",
			84,
			"letters replaced by lookalike digits",
		);
	}

	if (aSep === bSep) {
		return hit(
			"separator-variant",
			80,
			"differs only by hyphens or underscores",
		);
	}

	if (digraphFold(aSep) === digraphFold(bSep)) {
		return hit(
			"digraph-lookalike",
			78,
			'multi-character lookalike, e.g. "rn" for "m"',
		);
	}

	if (foldRepeats(aSep) === foldRepeats(bSep)) {
		return hit("doubled-character", 72, "a character doubled or de-doubled");
	}

	if (osaDistance(aSep, bSep, 2) === 1) {
		return hit("single-character-edit", 76, "one character away");
	}

	if (isSwap(aSep, bSep)) {
		return hit("character-swap", 76, "two characters swapped");
	}

	if (osaDistance(aSep, bSep, 2) === 2 && bSep.length >= 8) {
		return hit("near-miss", 58, "two characters away");
	}

	if (
		bSep.length >= 5 &&
		aSep.includes(bSep) &&
		aSep.length - bSep.length <= 8
	) {
		return hit("affix-wrap", 62, "wraps the protected name in extra words");
	}

	return null;
}

/** The strongest resemblance between the author's login and a protected one. */
export function check(login: string, targets: Protected[]): Match | null {
	let best: Omit<Match, "severity"> | null = null;
	for (const target of targets) {
		const hit = match(login, target);
		if (hit && (!best || hit.score > best.score)) best = hit;
	}
	return best ? { ...best, severity: severityOf(best.score) } : null;
}
