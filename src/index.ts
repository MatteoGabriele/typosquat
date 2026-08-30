import { appendFileSync, readFileSync } from "node:fs";
import {
	atLeast,
	check,
	type FailOn,
	isBotLogin,
	type Protected,
	SEVERITIES,
	type Severity,
} from "./check.js";
import { TRUSTED } from "./trusted.js";

const API = process.env.GITHUB_API_URL || "https://api.github.com";

const log = (msg: string): void => {
	process.stdout.write(`${msg}\n`);
};

const input = (name: string, fallback = ""): string => {
	const raw = process.env[`INPUT_${name.replace(/ /g, "_").toUpperCase()}`];
	return raw === undefined || raw.trim() === "" ? fallback : raw.trim();
};

/** Accepts newline- and comma-separated lists; tolerates a leading "@". */
const list = (raw: string): string[] =>
	raw
		.split(/[\n,]/)
		.map((s) => s.trim().replace(/^@/, ""))
		.filter(Boolean);

function setOutput(name: string, value: string): void {
	const file = process.env.GITHUB_OUTPUT;
	if (!file) {
		log(`output ${name}=${value}`);
		return;
	}
	appendFileSync(file, `${name}=${value}\n`);
}

/** The one thing this action reads from the webhook: who opened the thread. */
function authorOf(eventPath: string): string {
	const payload = JSON.parse(readFileSync(eventPath, "utf8")) as {
		pull_request?: { user?: { login?: string } | null } | null;
		issue?: { user?: { login?: string } | null } | null;
	};
	return payload.pull_request?.user?.login ?? payload.issue?.user?.login ?? "";
}

/** Best-effort: contributors are a bonus, a failed lookup is not an error. */
async function contributors(
	repository: string,
	token: string,
): Promise<string[]> {
	const res = await fetch(
		`${API}/repos/${repository}/contributors?per_page=100`,
		{
			headers: {
				accept: "application/vnd.github+json",
				"user-agent": "typosquat",
				...(token ? { authorization: `Bearer ${token}` } : {}),
			},
		},
	).catch(() => null);
	if (!res?.ok) return [];
	const body = (await res.json().catch(() => [])) as { login?: string }[];
	return Array.isArray(body)
		? body.flatMap((c) => (c.login ? [c.login] : []))
		: [];
}

async function run(): Promise<void> {
	const eventPath = process.env.GITHUB_EVENT_PATH;
	if (!eventPath)
		throw new Error(
			"GITHUB_EVENT_PATH is not set; run this inside GitHub Actions.",
		);

	const repository = process.env.GITHUB_REPOSITORY ?? "/";
	const owner = repository.split("/")[0];
	const token = input("github-token", process.env.GITHUB_TOKEN ?? "");
	const allow = new Set(list(input("allow")).map((l) => l.toLowerCase()));
	const failOn = input("fail-on", "never").toLowerCase() as FailOn;

	const author = authorOf(eventPath);
	setOutput("actor", author);

	const clear = (reason: string): void => {
		log(`No match: ${reason}`);
		setOutput("risk", "none");
		setOutput("score", "0");
		setOutput("resembles", "");
		setOutput("rule", "");
	};

	if (!author)
		return clear("the event carries no issue or pull request author");
	// "[" and "]" are illegal in a human login, so this suffix cannot be forged.
	if (/\[bot\]$/i.test(author))
		return clear(`${author} is a genuine GitHub App`);
	if (allow.has(author.toLowerCase()))
		return clear(`${author} is on the allow list`);

	const logins = [
		...TRUSTED,
		owner,
		...list(input("protect")),
		...(await contributors(repository, token)),
	];
	const seen = new Set<string>();
	const targets: Protected[] = [];
	for (const login of logins) {
		const key = login.toLowerCase();
		if (!login || seen.has(key) || allow.has(key)) continue;
		seen.add(key);
		targets.push({ login, isBot: isBotLogin(login) });
	}

	log(`Checking ${author} against ${targets.length} protected logins.`);
	const result = check(author, targets);
	if (!result) return clear(`${author} resembles none of them`);

	setOutput("risk", result.severity);
	setOutput("score", String(result.score));
	setOutput("resembles", result.resembles);
	setOutput("rule", result.rule);
	log(
		`::warning::${author} resembles ${result.resembles} - ${result.reason} (${result.severity}, ${result.score}/100).`,
	);

	if (
		SEVERITIES.includes(failOn as Severity) &&
		atLeast(result.severity, failOn as Severity)
	) {
		log(`::error::Risk "${result.severity}" meets fail-on "${failOn}".`);
		process.exitCode = 1;
	}
}

run().catch((err: unknown) => {
	log(
		`::error::typosquat failed: ${err instanceof Error ? err.message : String(err)}`,
	);
	process.exitCode = 1;
});
