import { expect, test } from "vitest";
import { isSwap, osaDistance } from "../src/distance.js";

test("distance is zero for identical strings", () => {
	expect(osaDistance("dependabot", "dependabot")).toBe(0);
});

test("adjacent transposition costs one, not two", () => {
	expect(osaDistance("dependabot", "dependbaot")).toBe(1);
});

test("substitution, insertion and deletion each cost one", () => {
	expect(osaDistance("dependabot", "dependabor")).toBe(1);
	expect(osaDistance("dependabot", "dependaboot")).toBe(1);
	expect(osaDistance("dependabot", "dependabo")).toBe(1);
});

test("empty strings fall back to length", () => {
	expect(osaDistance("", "abc")).toBe(3);
	expect(osaDistance("abc", "")).toBe(3);
});

test("the max bound short-circuits without lying about small distances", () => {
	expect(osaDistance("dependabot", "dependabor", 2)).toBe(1);
	expect(osaDistance("dependabot", "completely-different", 2)).toBeGreaterThan(
		2,
	);
});

test("a swap of two characters is recognised however far apart they sit", () => {
	expect(isSwap("depenbadot", "dependabot")).toBe(true);
	expect(isSwap("dependbaot", "dependabot")).toBe(true);
	expect(isSwap("dependabot", "dependabot")).toBe(false);
	expect(isSwap("dependabor", "dependabot")).toBe(false);
	expect(isSwap("dependabo", "dependabot")).toBe(false);
	expect(isSwap("aaaa", "bbbb")).toBe(false);
});
