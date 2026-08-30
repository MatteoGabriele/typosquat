import { isSwap, osaDistance } from "./distance.js";
import {
	botBase,
	digraphFold,
	foldLeet,
	foldRepeats,
	foldSeparators,
	isNameOpaque,
	stripBotAffix,
	stripRoleAffix,
} from "./text.js";

export type Severity = "none" | "low" | "medium" | "high" | "critical";

/**
 * What the action does with a match, beyond the outputs and the annotation.
 *
 * `full` comments and labels, `comment` and `labels` do one of the two, and
 * `silent` does neither. Whether the job also goes red is a separate question,
 * answered by `fail-on-match`: a silent run can still fail, and a full one can
 * be told not to.
 */
export type Mode = "full" | "labels" | "comment" | "silent";

export const MODES: readonly Mode[] = ["full", "labels", "comment", "silent"];

export interface Protected {
	login: string;
	isBot: boolean;
}

export const SEVERITIES: readonly Severity[] = [
	"none",
	"low",
	"medium",
	"high",
	"critical",
];

/**
 * One question sets the level: could someone land on this name by accident?
 *
 * The higher the level, the less believable "coincidence" gets.
 */
const RULES = [
	["bot-base-name-squat", "critical"],
	["digit-substitution", "critical"],
	["bot-affix-variant", "critical"],
	["authority-affix", "critical"],
	["separator-variant", "critical"],
	["digraph-lookalike", "critical"],
	["doubled-character", "high"],
	["single-character-edit", "high"],
	["character-swap", "high"],
	["affix-wrap", "medium"],
	["near-miss", "low"],
] as const satisfies ReadonlyArray<readonly [string, Severity]>;

export type Rule = (typeof RULES)[number][0];

/** The level in one sentence, for whoever reads the run. */
export const MEANING: Record<Severity, string> = {
	none: "Nothing here looks like a protected name.",
	low: "Vaguely similar. Most accounts this far out are strangers with similar names.",
	medium:
		"A protected name with extra words around it. Mirrors and forks look like this too.",
	high: "One slip away from a protected name: could be a typo, could be a fake.",
	critical: "Copied on purpose. Nobody types this name by accident.",
};

export interface Match {
	rule: Rule;
	score: number;
	severity: Severity;
	/** The protected login the author resembles. */
	resembles: string;
	reason: string;
}

const RANK = new Map<Rule, number>(RULES.map(([rule], i) => [rule, i]));
const RULE_SEVERITY = new Map<Rule, Severity>(RULES);

// The floor of each severity.
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

const CENTRE: Record<Severity, number> = {
	none: 0,
	low: 30,
	medium: 50,
	high: 70,
	critical: 90,
};

function scoreOf(rule: Rule, severity: Severity): number {
	const spread = (RANK.get(rule) ?? 0) / Math.max(1, RULES.length - 1);
	return CENTRE[severity] + 5 - Math.round(spread * 10);
}

function promote(severity: Severity): Severity {
	const next = SEVERITIES.indexOf(severity) + 1;
	return SEVERITIES[Math.min(next, SEVERITIES.length - 1)];
}

export const isBotLogin = (login: string): boolean =>
	/\[bot\]$/i.test(login) || /(?:^|[-_])bot$/i.test(login);

// Rules that already tolerate distance do not also earn the promotion.
const LOOSE_RULES: ReadonlySet<string> = new Set(["near-miss", "affix-wrap"]);

// Rules against one protected login, strongest first. First hit wins.
function match(login: string, target: Protected): Match | null {
	const base = botBase(target.login);
	if (base.length < 4) {
		return null;
	}

	const a = login.toLowerCase();
	const b = base.toLowerCase();
	if (a === b && !target.isBot) {
		return null;
	}

	/**
	 * A login nobody can read is a login nobody can check. `yyx990803` and
	 * `43081j` are as legitimate as `danielroe` and far easier to imitate,
	 * because the reader has no word to compare against. A resemblance to one of
	 * those counts one level higher than the same resemblance to a name that can
	 * be read.
	 */
	const opaque = isNameOpaque(base);

	const hit = (rule: Rule, reason: string): Match => {
		const boost = opaque && !LOOSE_RULES.has(rule);
		const declared = RULE_SEVERITY.get(rule) as Severity;
		const severity = boost ? promote(declared) : declared;
		return {
			rule,
			severity,
			score: scoreOf(rule, severity),
			resembles: target.login,
			reason: boost
				? `${reason}, and ${target.login} is not a name a reader can check by eye`
				: reason,
		};
	};

	if (a === b) {
		// A login cannot contain "[" or "]", so the bare stem of a GitHub App is
		// always a separate, human-registered account.
		return hit(
			"bot-base-name-squat",
			`login is the bare name of the GitHub App ${target.login}`,
		);
	}

	const aSep = foldSeparators(a);
	const bSep = foldSeparators(b);

	if (foldLeet(a) === foldLeet(b) && aSep !== bSep) {
		return hit("digit-substitution", "letters replaced by lookalike digits");
	}

	if (target.isBot && foldSeparators(stripBotAffix(a)) === bSep) {
		return hit("bot-affix-variant", `hand-made variant of ${target.login}`);
	}

	// Stripped from both sides: "danielroe-official" against "danielroe", and
	// "patak" against "patak-dev". Either direction is the same claim.
	const aRole = foldSeparators(stripRoleAffix(a));
	const bRole = foldSeparators(stripRoleAffix(b));
	if (aRole === bRole && aSep !== bSep && bRole.length >= 4) {
		return hit(
			"authority-affix",
			`claims to be an official or personal account of ${target.login}`,
		);
	}

	if (aSep === bSep) {
		return hit("separator-variant", "differs only by hyphens or underscores");
	}

	if (digraphFold(aSep) === digraphFold(bSep)) {
		return hit(
			"digraph-lookalike",
			'multi-character lookalike, e.g. "rn" for "m"',
		);
	}

	if (foldRepeats(aSep) === foldRepeats(bSep)) {
		return hit("doubled-character", "a character doubled or de-doubled");
	}

	// Ahead of the swap: OSA scores an adjacent transposition as one edit, and
	// "one character away" is the plainer thing to tell a reader.
	if (osaDistance(aSep, bSep, 2) === 1) {
		return hit("single-character-edit", "one character away");
	}

	if (isSwap(aSep, bSep)) {
		return hit("character-swap", "two characters swapped");
	}

	if (
		bSep.length >= 5 &&
		aSep.includes(bSep) &&
		aSep.length - bSep.length <= 8
	) {
		return hit("affix-wrap", "wraps the protected name in extra words");
	}

	// Two edits is a wide net, so it needs a long name to stay quiet — unless
	// the name is opaque, in which case the reader has no chance of spotting
	// the two.
	if (
		osaDistance(aSep, bSep, 2) === 2 &&
		(bSep.length >= 8 || (opaque && bSep.length >= 5))
	) {
		return hit("near-miss", "two characters away");
	}

	return null;
}

export function atLeast(severity: Severity, minimum: Severity): boolean {
	return SEVERITIES.indexOf(severity) >= SEVERITIES.indexOf(minimum);
}

/** A match is always reported. This only decides whether the job also fails. */
export function shouldFail(severity: Severity, failOnMatch: boolean): boolean {
	return failOnMatch && severity !== "none";
}

/**
 * Reporting is the default and failing is opt-in, so only an explicit "true"
 * turns a lookalike into a red job. A typo leaves the run where it started:
 * the finding is still on the thread, and nobody is blocked by a mistyped flag.
 */
export function failOnMatchOf(raw: string): boolean {
	return raw.trim().toLowerCase() === "true";
}

/** An unknown mode falls back to `full`; the caller says so out loud. */
export function modeOf(raw: string): Mode | null {
	const value = raw.trim().toLowerCase();
	return (MODES as string[]).includes(value) ? (value as Mode) : null;
}

export const wantsComment = (mode: Mode): boolean =>
	mode === "full" || mode === "comment";

export const wantsLabel = (mode: Mode): boolean =>
	mode === "full" || mode === "labels";

// The strongest resemblance between the author's login and a protected one.
export function check(login: string, targets: Protected[]): Match | null {
	let best: Match | null = null;

	for (const target of targets) {
		const hit = match(login, target);
		if (hit && (!best || hit.score > best.score)) best = hit;
	}

	return best;
}
