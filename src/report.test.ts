import { expect, test } from "vitest";
import { check, type Protected } from "../src/check.js";
import { buildComment, MARKER } from "../src/report.js";

const TARGETS: Protected[] = [{ login: "dependabot[bot]", isBot: true }];

test("the comment carries the marker that makes a re-run edit it", () => {
	const result = check("dependab0t", TARGETS);
	if (!result) throw new Error("expected a match");

	const body = buildComment("dependab0t", result);

	expect(body.startsWith(MARKER)).toBe(true);
	expect(body).toContain("dependab0t");
	expect(body).toContain("dependabot[bot]");
	// The level and its plain-words meaning, so the note stands on its own.
	expect(body).toContain("CRITICAL");
	expect(body).toContain("Nobody types this name by accident");
});
