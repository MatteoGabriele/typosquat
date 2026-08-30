// A GitHub login may only contain [A-Za-z0-9-] (single hyphens, 39 chars max),
// so Unicode homoglyph attacks are impossible here. Login attacks are ASCII:
// typos, digit substitution, hyphen games and bot-ish affixes.

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
