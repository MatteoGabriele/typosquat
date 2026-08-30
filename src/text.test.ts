import { expect, test } from "vitest";
import {
	botBase,
	digraphFold,
	foldLeet,
	foldRepeats,
	foldSeparators,
	isNameOpaque,
	stripBotAffix,
	stripRoleAffix,
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

test("opaque logins are the ones with nothing to read", () => {
	expect(isNameOpaque("yyx990803")).toBe(true);
	expect(isNameOpaque("43081j")).toBe(true);
	expect(isNameOpaque("danielroe")).toBe(false);
	expect(isNameOpaque("TkDodo")).toBe(false);
	expect(isNameOpaque("codecov-io"), "one digit-free word").toBe(false);
	expect(isNameOpaque("k8s-operator"), "a lone digit is not noise").toBe(false);
});

test("stripRoleAffix removes authority claims from either end", () => {
	expect(stripRoleAffix("danielroe-official")).toBe("danielroe");
	expect(stripRoleAffix("real-danielroe")).toBe("danielroe");
	expect(stripRoleAffix("the-real-danielroe")).toBe("danielroe");
	expect(stripRoleAffix("danielroe")).toBe("danielroe");
	expect(stripRoleAffix("andrea"), "needs a separator").toBe("andrea");
});
