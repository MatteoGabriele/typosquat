// A GitHub login may only contain [A-Za-z0-9-] (single hyphens, 39 chars max),
// so Unicode homoglyph attacks are impossible here. Login attacks are ASCII:
// typos, digit substitution, hyphen games and borrowed affixes. Bots and
// people are impersonated the same way; the folds below do not distinguish.

/** Multi-character lookalikes: "rn" reads as "m". */
export function digraphFold(input: string): string {
	return input
		.replace(/rn/g, "m")
		.replace(/vv/g, "w")
		.replace(/cl/g, "d")
		.replace(/nn/g, "m");
}

/** Lowercase and drop separators. "depend-a-bot" -> "dependabot" */
export function foldSeparators(input: string): string {
	return input.toLowerCase().replace(/[-_.\s]/g, "");
}

const LEET: Record<string, string> = {
	0: "o",
	1: "l",
	2: "z",
	3: "e",
	4: "a",
	5: "s",
	6: "g",
	7: "t",
	8: "b",
	9: "g",
};

/** Separator fold plus digit-for-letter substitution. "dependab0t" -> "dependabot" */
export function foldLeet(input: string): string {
	let out = "";
	for (const ch of foldSeparators(input)) out += LEET[ch] ?? ch;
	return out;
}

/** Collapse runs of the same character. "dependabbot" -> "dependabot" */
export function foldRepeats(input: string): string {
	return input.replace(/(.)\1+/g, "$1");
}

/**
 * True when a login carries no readable structure to check it against: digit
 * runs, or no vowels at all. `yyx990803` and `43081j` are unique but
 * unmemorable. A maintainer skimming a notification cannot tell `yyx990803`
 * from `yyx990830`. Opaque logins therefore need a wider net and a louder warning.
 */
export function isNameOpaque(login: string): boolean {
	const s = foldSeparators(login);

	if (s.length < 4) {
		return false;
	}

	const digits = (s.match(/\d/g) ?? []).length;
	return digits / s.length >= 0.3 || /\d{3,}/.test(s) || !/[aeiou]/.test(s);
}

/** "dependabot[bot]" -> "dependabot" */
export function botBase(login: string): string {
	return login.replace(/\[bot\]$/i, "");
}

const BOT_AFFIX_RE =
	/^(?:the[-_]?)?(.*?)[-_]?(?:bot|app|ci|io|hq|team|official|inc|dev)$/i;

/** Strip a trailing bot-ish word: "renovate-bot" -> "renovate". */
export function stripBotAffix(login: string): string {
	const m = BOT_AFFIX_RE.exec(login);
	return m && m[1].length >= 3 ? m[1] : login;
}

// Words that claim authority over an identity rather than describe one.
// Unlike the bot affixes above, these must be separated from the stem: a
// person called "andrea" is not impersonating "andre", but "andre-official"
// is making a claim about "andre".
const ROLE_AFFIX =
	"official|real|the|verified|hq|team|dev|devs|org|oss|inc|main|prod|support|admin|staff|help|security|updates|news";

const ROLE_PREFIX_RE = new RegExp(`^(?:${ROLE_AFFIX})[-_.](.+)$`, "i");
const ROLE_SUFFIX_RE = new RegExp(`^(.+)[-_.](?:${ROLE_AFFIX})$`, "i");

/**
 * Strip an authority claim from either end: "danielroe-official" and
 * "real-danielroe" both reduce to "danielroe". Applies to people as much as
 * to bots. Impersonating a maintainer works the same way.
 */
export function stripRoleAffix(login: string): string {
	let out = login;
	// Repeat so stacked claims collapse: "the-real-danielroe" -> "danielroe".
	for (let pass = 0; pass < 4; pass++) {
		const before = out;
		for (const re of [ROLE_PREFIX_RE, ROLE_SUFFIX_RE]) {
			const m = re.exec(out);
			if (m && m[1].length >= 3) {
				out = m[1];
			}
		}
		if (out === before) {
			break;
		}
	}
	return out;
}
