import { expect, test } from "vitest";
import {
	botBase,
	digraphFold,
	foldLeet,
	foldRepeats,
	foldSeparators,
	stripBotAffix,
} from "../src/text.js";

test("separator folding ignores hyphens and underscores", () => {
	expect(foldSeparators("depend-a-bot")).toBe("dependabot");
	expect(foldSeparators("DEPEND_A_BOT")).toBe("dependabot");
});

test("leet folding maps digits back to letters", () => {
	expect(foldLeet("dependab0t")).toBe("dependabot");
	expect(foldLeet("d3p3ndab07")).toBe("dependabot");
});

test("repeat folding collapses doubled characters", () => {
	expect(foldRepeats("dependabbot")).toBe(foldRepeats("dependabot"));
});

test("digraph folding treats rn as m", () => {
	expect(digraphFold("rnicrosoft")).toBe(digraphFold("microsoft"));
});

test("botBase and stripBotAffix reduce app names to their stem", () => {
	expect(botBase("dependabot[bot]")).toBe("dependabot");
	expect(stripBotAffix("renovate-bot")).toBe("renovate");
	expect(stripBotAffix("renovate")).toBe("renovate");
	expect(stripBotAffix("bot"), "too short to strip").toBe("bot");
});
