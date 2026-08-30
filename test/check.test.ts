import { expect, test } from "vitest";
import {
	atLeast,
	check,
	isBotLogin,
	type Protected,
	severityOf,
} from "../src/check.js";

const TARGETS: Protected[] = [
	{ login: "dependabot[bot]", isBot: true },
	{ login: "renovate[bot]", isBot: true },
	{ login: "github-actions[bot]", isBot: true },
	{ login: "MatteoGabriele", isBot: false },
	{ login: "danielroe", isBot: false },
	{ login: "yyx990803", isBot: false },
	{ login: "43081j", isBot: false },
	{ login: "octocat", isBot: false },
];

const run = (login: string) => check(login, TARGETS);

test("the motivating case: depenbadot is caught as a swap of dependabot", () => {
	const result = run("depenbadot");
	expect(result?.rule).toBe("character-swap");
	expect(result?.resembles).toBe("dependabot[bot]");
	expect(atLeast(result?.severity ?? "none", "high")).toBe(true);
});

test("digit substitution is caught", () => {
	expect(run("dependab0t")?.rule).toBe("digit-substitution");
	expect(run("dependab0t")?.severity).toBe("critical");
});

test("hyphen games are caught", () => {
	expect(run("depend-a-bot")?.rule).toBe("separator-variant");
});

test("registering the bare name of a GitHub App is the strongest signal", () => {
	const result = run("dependabot");
	expect(result?.rule).toBe("bot-base-name-squat");
	expect(result?.severity).toBe("critical");
});

test("a hand-rolled bot suffix is caught", () => {
	expect(run("renovate-bot")?.rule).toBe("bot-affix-variant");
});

test("one-character typos are caught", () => {
	expect(run("dependabor")?.rule).toBe("single-character-edit");
});

test("a doubled character is caught", () => {
	expect(run("dependabbot")?.rule).toBe("doubled-character");
});

test("affix wrapping scores lower than an exact lookalike", () => {
	const wrapped = run("dependabot-mirror");
	expect(wrapped?.rule).toBe("affix-wrap");
	expect(wrapped?.score).toBeLessThan(run("dependab0t")?.score ?? 0);
});

test("an authority claim outscores a plain wrap, for people as for bots", () => {
	expect(run("danielroe-official")?.rule).toBe("authority-affix");
	expect(run("real-danielroe")?.rule).toBe("authority-affix");
	expect(run("dependabot-security")?.rule).toBe("authority-affix");
	expect(run("danielroe-official")?.score).toBeGreaterThan(
		run("danielroe-mirror")?.score ?? 0,
	);
});

test("stacked authority claims collapse", () => {
	expect(run("the-real-danielroe")?.resembles).toBe("danielroe");
});

test("a typo on a readable maintainer name is caught", () => {
	const result = run("danieleroe");
	expect(result?.rule).toBe("single-character-edit");
	expect(result?.resembles).toBe("danielroe");
	expect(atLeast(result?.severity ?? "none", "high")).toBe(true);
});

test("an opaque login scores higher than a readable one for the same typo", () => {
	// Both are a single edit away; only one of them can be checked by eye.
	const opaque = run("yyx990830");
	const readable = run("danieleroe");
	expect(opaque?.rule).toBe("single-character-edit");
	expect(opaque?.score).toBeGreaterThan(readable?.score ?? 0);
});

test("short opaque logins get the two-edit net that short words do not", () => {
	// "43081j" is six characters, below the length gate for readable names.
	expect(run("4308ik")?.rule).toBe("near-miss");
	expect(run("octicit"), "two edits, seven readable characters").toBe(null);
});

test("a maintainer login is defended too", () => {
	expect(run("MatteoGabrie1e")?.resembles).toBe("MatteoGabriele");
});

test("unrelated accounts produce nothing", () => {
	expect(run("matteo-writes-tests")).toBe(null);
});

test("the protected account itself is never flagged", () => {
	expect(run("MatteoGabriele")).toBe(null);
	expect(run("octocat")).toBe(null);
});

test("short protected names do not generate noise", () => {
	expect(check("bots", [{ login: "bot", isBot: true }])).toBe(null);
});

test("the strongest match wins when several apply", () => {
	expect(run("dependab0t")?.score).toBeGreaterThan(
		run("dependabot-x")?.score ?? 0,
	);
});

test("score bands map to severities", () => {
	expect(severityOf(95)).toBe("critical");
	expect(severityOf(80)).toBe("critical");
	expect(severityOf(60)).toBe("high");
	expect(severityOf(40)).toBe("medium");
	expect(severityOf(20)).toBe("low");
	expect(severityOf(0)).toBe("none");
});

test("bot logins are recognised by suffix", () => {
	expect(isBotLogin("dependabot[bot]")).toBe(true);
	expect(isBotLogin("snyk-bot")).toBe(true);
	expect(isBotLogin("octocat")).toBe(false);
});
