// One command: build the rules, serve the page, open a browser, and rebuild
// whenever src/ or playground/ changes. Dev-only, no dependencies.
import { spawn } from "node:child_process";
import { watch } from "node:fs";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, resolve, sep } from "node:path";

const root = import.meta.dirname;
const repo = resolve(root, "..");
const port = Number(process.env.PORT) || 4173;
const win = process.platform === "win32";

const TYPES = {
	".html": "text/html; charset=utf-8",
	".js": "text/javascript; charset=utf-8",
	".css": "text/css; charset=utf-8",
	".json": "application/json",
};

// Injected into the served page only; the committed index.html stays static.
const LIVE_RELOAD =
	'\n<script>new EventSource("/__reload").onmessage = () => location.reload();</script>\n';

const clients = new Set();

const build = () =>
	new Promise((done) => {
		const tsdown = spawn(
			win ? "tsdown.cmd" : "tsdown",
			["--config", join(root, "tsdown.config.ts")],
			{
				cwd: repo,
				stdio: ["ignore", "ignore", "inherit"],
			},
		);
		tsdown.on("close", (code) => done(code === 0));
	});

const server = createServer(async (req, res) => {
	const path = (req.url ?? "/").split("?")[0];

	if (path === "/__reload") {
		res.writeHead(200, {
			"content-type": "text/event-stream",
			"cache-control": "no-cache",
			connection: "keep-alive",
		});
		res.write("retry: 500\n\n");
		clients.add(res);
		req.on("close", () => clients.delete(res));
		return;
	}

	const file = join(root, path === "/" ? "index.html" : path);
	if (!file.startsWith(root + sep)) {
		res.writeHead(403).end("Forbidden");
		return;
	}

	try {
		const type = TYPES[extname(file)] ?? "application/octet-stream";
		const body = await readFile(file);
		res.writeHead(200, { "content-type": type, "cache-control": "no-store" });
		res.end(type.startsWith("text/html") ? body + LIVE_RELOAD : body);
	} catch {
		res.writeHead(404).end("Not found");
	}
});

let pending;
const rebuild = () => {
	clearTimeout(pending);
	pending = setTimeout(async () => {
		if (!(await build())) return;
		process.stdout.write("  rebuilt\n");
		for (const client of clients) client.write("data: reload\n\n");
	}, 80);
};

if (!(await build())) {
	process.stdout.write("Build failed.\n");
	process.exit(1);
}

for (const dir of [join(repo, "src"), root]) {
	watch(dir, { recursive: true }, (_event, name) => {
		if (name && !name.endsWith("check.iife.js")) rebuild();
	});
}

server.listen(port, () => {
	const url = `http://localhost:${port}`;
	process.stdout.write(
		`\n  Playground running at ${url}\n  Watching src/ — edit a rule and the page reloads.\n\n`,
	);
	const open = win
		? "start"
		: process.platform === "darwin"
			? "open"
			: "xdg-open";
	spawn(open, [url], { stdio: "ignore", detached: true, shell: win }).unref();
});
