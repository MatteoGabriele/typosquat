import { appendFileSync, readFileSync } from "node:fs";
import {
	check,
	failOnMatchOf,
	isBotLogin,
	type Match,
	MEANING,
	MODES,
	type Mode,
	modeOf,
	type Protected,
	shouldFail,
	wantsComment,
	wantsLabel,
} from "./check.js";
import { buildComment, MARKER } from "./report.js";
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

/** What this action reads from the webhook: who opened the thread, and where. */
function threadOf(eventPath: string): { author: string; number: number } {
	const payload = JSON.parse(readFileSync(eventPath, "utf8")) as {
		pull_request?: Thread | null;
		issue?: Thread | null;
	};
	const thread = payload.pull_request ?? payload.issue;
	return { author: thread?.user?.login ?? "", number: thread?.number ?? 0 };
}

interface Thread {
	number?: number;
	user?: { login?: string } | null;
}

async function api<T>(
	method: string,
	path: string,
	token: string,
	body?: unknown,
): Promise<T | null> {
	const res = await fetch(`${API}${path}`, {
		method,
		headers: {
			accept: "application/vnd.github+json",
			"user-agent": "typosquat",
			...(token ? { authorization: `Bearer ${token}` } : {}),
			...(body ? { "content-type": "application/json" } : {}),
		},
		...(body ? { body: JSON.stringify(body) } : {}),
	}).catch(() => null);

	if (!res?.ok) {
		return null;
	}

	return (await res.json().catch(() => null)) as T | null;
}

/** Best-effort: contributors are a bonus, a failed lookup is not an error. */
async function contributors(
	repository: string,
	token: string,
): Promise<string[]> {
	const body = await api<{ login?: string }[]>(
		"GET",
		`/repos/${repository}/contributors?per_page=100`,
		token,
	);

	return Array.isArray(body)
		? body.flatMap((c) => (c.login ? [c.login] : []))
		: [];
}

/**
 * One note per thread: our own comment is found by its marker and rewritten,
 * so a thread checked ten times still reads as one observation.
 */
async function comment(
	repository: string,
	number: number,
	token: string,
	body: string,
): Promise<void> {
	const existing = await api<{ id: number; body?: string }[]>(
		"GET",
		`/repos/${repository}/issues/${number}/comments?per_page=100`,
		token,
	);

	const mine = Array.isArray(existing)
		? existing.find((c) => c.body?.includes(MARKER))
		: undefined;

	const done = mine
		? await api(
				"PATCH",
				`/repos/${repository}/issues/comments/${mine.id}`,
				token,
				{ body },
			)
		: await api(
				"POST",
				`/repos/${repository}/issues/${number}/comments`,
				token,
				{ body },
			);

	if (!done) {
		throw new Error("the comment could not be posted");
	}
}

async function label(
	repository: string,
	number: number,
	token: string,
	name: string,
): Promise<void> {
	const done = await api(
		"POST",
		`/repos/${repository}/issues/${number}/labels`,
		token,
		{ labels: [name] },
	);

	if (!done) {
		throw new Error(`the label "${name}" could not be added`);
	}
}

/**
 * Commenting and labelling are how the finding is delivered, not the finding
 * itself. A missing permission must not swallow the verdict, so a failure here
 * is reported and the run carries on to its exit code.
 */
async function act(
	mode: Mode,
	result: Match,
	author: string,
	ctx: { repository: string; number: number; token: string; label: string },
): Promise<void> {
	if (mode === "silent" || ctx.number === 0) {
		return;
	}

	try {
		if (wantsComment(mode)) {
			await comment(
				ctx.repository,
				ctx.number,
				ctx.token,
				buildComment(author, result),
			);
		}

		if (wantsLabel(mode)) {
			await label(ctx.repository, ctx.number, ctx.token, ctx.label);
		}
	} catch (err: unknown) {
		log(
			`::warning::The match was found but not posted: ${err instanceof Error ? err.message : String(err)}. Check the job's "issues: write" and "pull-requests: write" permissions.`,
		);
	}
}

/**
 * Two older spellings asked the failing question, and both still answer it:
 * `mode: strict` / `mode: warn`, and `fail-on: <level>` / `fail-on: never`.
 * A workflow that asked to fail keeps failing, even though new ones do not.
 */
function failOnMatchFrom(mode: string): boolean {
	const legacy: Record<string, boolean> = {
		strict: true,
		warn: false,
		log: false,
	};

	if (mode in legacy) {
		return legacy[mode] ?? false;
	}

	const failOn = input("fail-on");

	if (failOn) {
		return failOn.toLowerCase() !== "never";
	}

	return failOnMatchOf(input("fail-on-match"));
}

function settingsOf(): { mode: Mode; failOnMatch: boolean } {
	const raw = input("mode", "full");
	const value = raw.toLowerCase();
	const failOnMatch = failOnMatchFrom(value);

	if (value === "strict" || value === "warn" || value === "log") {
		log(
			`::warning::"mode: ${raw}" is the old spelling; it now means "fail-on-match: ${failOnMatch}". Set "fail-on-match" instead — "mode" chooses between ${MODES.join(", ")}.`,
		);
		return { mode: "full", failOnMatch };
	}

	const mode = modeOf(raw);

	if (!mode) {
		log(`::warning::Unknown mode "${raw}"; falling back to "full".`);
	}

	return { mode: mode ?? "full", failOnMatch };
}

async function run(): Promise<void> {
	const eventPath = process.env.GITHUB_EVENT_PATH;
	if (!eventPath) {
		throw new Error(
			"GITHUB_EVENT_PATH is not set; run this inside GitHub Actions.",
		);
	}

	const repository = process.env.GITHUB_REPOSITORY ?? "/";
	const owner = repository.split("/")[0];
	const token = input("github-token", process.env.GITHUB_TOKEN ?? "");
	const allow = new Set(list(input("allow")).map((l) => l.toLowerCase()));
	const { mode, failOnMatch } = settingsOf();

	const { author, number } = threadOf(eventPath);
	setOutput("actor", author);

	const clear = (reason: string): void => {
		log(`No match: ${reason}`);
		setOutput("risk", "none");
		setOutput("score", "0");
		setOutput("resembles", "");
		setOutput("rule", "");
	};

	if (!author) {
		return clear("the event carries no issue or pull request author");
	}

	if (/\[bot\]$/i.test(author)) {
		return clear(`${author} is a genuine GitHub App`);
	}

	if (allow.has(author.toLowerCase())) {
		return clear(`${author} is on the allow list`);
	}

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

		if (!login || seen.has(key) || allow.has(key)) {
			continue;
		}

		seen.add(key);
		targets.push({ login, isBot: isBotLogin(login) });
	}

	log(`Checking ${author} against ${targets.length} protected logins.`);

	const result = check(author, targets);
	if (!result) {
		return clear(`${author} resembles none of them`);
	}

	setOutput("risk", result.severity);
	setOutput("score", String(result.score));
	setOutput("resembles", result.resembles);
	setOutput("rule", result.rule);

	log(
		`::warning::${result.severity.toUpperCase()}: ${author} looks like ${result.resembles} (${result.reason}). ${MEANING[result.severity]}`,
	);

	await act(mode, result, author, {
		repository,
		number,
		token,
		label: input("label", "typosquat:lookalike"),
	});

	if (shouldFail(result.severity, failOnMatch)) {
		log(
			`::error::Failing the job because ${author} looks like ${result.resembles}. Add "${author}" to "allow" if it is legitimate, or set "fail-on-match: false" to report without failing.`,
		);
		process.exitCode = 1;
	}
}

run().catch((err: unknown) => {
	log(
		`::error::typosquat failed: ${err instanceof Error ? err.message : String(err)}`,
	);
	process.exitCode = 1;
});
