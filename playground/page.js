// Playground UI. The rules come from check.iife.js (built from ../src by
// `pnpm playground`); everything here is presentation.
(() => {
	const HEADLINE = {
		low: "Faint resemblance",
		medium: "Resembles a protected login",
		high: "Probably imitating a protected login",
		critical: "Imitating a protected login",
	};

	const el = (id) => document.getElementById(id);
	const outEl = el("out");

	if (typeof TS === "undefined") {
		outEl.innerHTML =
			'<div class="card tone" style="--tone: var(--critical)">' +
			'<div class="verdict-head"><h2 class="verdict-title">The rule bundle is missing</h2></div>' +
			'<p class="reason" style="padding-bottom:20px">Run <code>pnpm playground</code> from the repository ' +
			"root to build <code>playground/check.iife.js</code>, then reload this page.</p></div>";
		return;
	}

	const loginEl = el("login");
	const extraEl = el("extra");
	const countEl = el("count");

	for (const bot of TS.TRUSTED) {
		const span = document.createElement("span");
		span.textContent = bot;
		el("bots").appendChild(span);
	}

	/** The built-in bots plus whatever the panel adds, deduplicated. */
	const targets = () => {
		const seen = new Set();
		const out = [];
		for (const raw of [...TS.TRUSTED, ...extraEl.value.split(/[\n,]/)]) {
			const login = raw.trim().replace(/^@/, "");
			if (!login || seen.has(login.toLowerCase())) continue;
			seen.add(login.toLowerCase());
			out.push({ login, isBot: TS.isBotLogin(login) });
		}
		return out;
	};

	/**
	 * Pair up the characters of two logins. Equal lengths line up position by
	 * position, so a swap reads as the two characters that traded places; unequal
	 * lengths fall back to a longest-common-subsequence walk, with a delete
	 * immediately followed by an insert merged back into one substitution.
	 */
	const align = (a, b) => {
		const n = a.length;
		const m = b.length;
		if (n === m) return [...a].map((ch, k) => [ch, b[k], ch === b[k]]);

		const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
		for (let i = n - 1; i >= 0; i--) {
			for (let j = m - 1; j >= 0; j--) {
				dp[i][j] =
					a[i] === b[j]
						? dp[i + 1][j + 1] + 1
						: Math.max(dp[i + 1][j], dp[i][j + 1]);
			}
		}

		const raw = [];
		let i = 0;
		let j = 0;
		while (i < n && j < m) {
			if (a[i] === b[j]) raw.push([a[i++], b[j++], true]);
			else if (dp[i + 1][j] >= dp[i][j + 1]) raw.push([a[i++], null, false]);
			else raw.push([null, b[j++], false]);
		}
		while (i < n) raw.push([a[i++], null, false]);
		while (j < m) raw.push([null, b[j++], false]);

		const merged = [];
		for (let k = 0; k < raw.length; k++) {
			const cur = raw[k];
			const next = raw[k + 1];
			if (
				next &&
				!cur[2] &&
				!next[2] &&
				cur[0] !== null &&
				cur[1] === null &&
				next[0] === null
			) {
				merged.push([cur[0], next[1], false]);
				k++;
			} else merged.push(cur);
		}
		return merged;
	};

	const cell = (ch, diff) => {
		const d = document.createElement("div");
		d.className = `cell${ch === null ? " gap" : diff ? " diff" : ""}`;
		d.textContent = ch === null ? "·" : ch;
		return d;
	};

	const alignment = (typed, protectedLogin) => {
		const pairs = align(
			typed.toLowerCase(),
			protectedLogin.replace(/\[bot\]$/i, "").toLowerCase(),
		);
		const wrap = document.createElement("div");
		wrap.className = "align";
		wrap.innerHTML = "<h3>Character alignment</h3>";

		const grid = document.createElement("div");
		grid.className = "align-grid";
		for (const side of [0, 1]) {
			const row = document.createElement("div");
			row.className = "align-row";
			const who = document.createElement("span");
			who.className = "who";
			who.textContent = side === 0 ? "typed" : "protected";
			row.appendChild(who);
			for (const pair of pairs) row.appendChild(cell(pair[side], !pair[2]));
			grid.appendChild(row);
		}

		const scroll = document.createElement("div");
		scroll.className = "align-scroll";
		scroll.appendChild(grid);
		wrap.appendChild(scroll);
		return wrap;
	};

	const BANDS = [
		[20, "low"],
		[40, "medium"],
		[60, "high"],
		[80, "critical"],
	];

	const meter = (score) => {
		const track = document.createElement("div");
		track.className = "meter-track";
		const fill = document.createElement("div");
		fill.className = "meter-fill";
		fill.style.width = `${Math.max(2, score)}%`;
		track.appendChild(fill);

		const scale = document.createElement("div");
		scale.className = "meter-scale";
		for (const [at, name] of BANDS) {
			const tick = document.createElement("div");
			tick.className = "meter-tick";
			tick.style.left = `${at}%`;
			track.appendChild(tick);

			const label = document.createElement("span");
			label.style.left = `${at}%`;
			label.textContent = name;
			scale.appendChild(label);
		}

		const value = document.createElement("div");
		value.className = "meter-value";
		value.innerHTML = `<b>${score}</b> / 100 confidence`;

		const wrap = document.createElement("div");
		wrap.className = "meter";
		wrap.append(track, scale, value);
		return wrap;
	};

	/** Re-run the check without each winner in turn, to show what else is close. */
	const runnersUp = (login, all, winner) => {
		let rest = all.filter((t) => t.login !== winner);
		const found = [];
		for (let n = 0; n < 4; n++) {
			const hit = TS.check(login, rest);
			if (!hit) break;
			found.push(hit);
			rest = rest.filter((t) => t.login !== hit.resembles);
		}
		if (!found.length) return null;

		const wrap = document.createElement("div");
		wrap.className = "also";
		wrap.innerHTML = "<h3>Also resembles</h3>";
		const list = document.createElement("ol");
		for (const f of found) {
			const li = document.createElement("li");
			li.innerHTML =
				`<span class="n">${f.score}</span>` +
				`<span class="who">${f.resembles}</span>` +
				`<span class="why">${f.reason}</span>`;
			list.appendChild(li);
		}
		wrap.appendChild(list);
		return wrap;
	};

	const plainCard = (tone, badge, title, body) => {
		const card = document.createElement("div");
		card.className = "card tone";
		card.style.setProperty("--tone", `var(--${tone})`);
		card.innerHTML =
			`<div class="verdict-head"><span class="badge">${badge}</span>` +
			`<h2 class="verdict-title">${title}</h2></div>` +
			`<p class="reason" style="padding-bottom:20px">${body}</p>`;
		return card;
	};

	const render = () => {
		const login = loginEl.value.trim().replace(/^@/, "");
		outEl.textContent = "";
		if (!login) return;

		// "[" and "]" are illegal in a human login, so this suffix cannot be forged.
		if (/\[bot\]$/i.test(login)) {
			outEl.appendChild(
				plainCard(
					"clear",
					"skipped",
					"Genuine GitHub App",
					"Only a GitHub App can post under a login ending in <code>[bot]</code>, " +
						"so the action passes it over without a check.",
				),
			);
			return;
		}

		const all = targets();
		const result = TS.check(login, all);

		if (!result) {
			outEl.appendChild(
				plainCard(
					"clear",
					"clear",
					"Resembles nobody",
					`No rule fired against any of the ${all.length} protected logins. ` +
						"The action would set <code>risk=none</code> and stay quiet.",
				),
			);
			return;
		}

		const card = document.createElement("div");
		card.className = "card tone";
		card.style.setProperty("--tone", `var(--${result.severity})`);

		const head = document.createElement("div");
		head.className = "verdict-head";
		head.innerHTML =
			`<span class="badge">${result.severity}</span>` +
			`<h2 class="verdict-title">${HEADLINE[result.severity]} <b>${result.resembles}</b></h2>` +
			`<span class="rule">${result.rule}</span>`;

		const reason = document.createElement("p");
		reason.className = "reason";
		reason.textContent = `${result.reason.charAt(0).toUpperCase()}${result.reason.slice(1)}.`;

		card.append(
			head,
			reason,
			meter(result.score),
			alignment(login, result.resembles),
		);
		const more = runnersUp(login, all, result.resembles);
		if (more) card.appendChild(more);
		outEl.appendChild(card);
	};

	loginEl.addEventListener("input", render);
	extraEl.addEventListener("input", () => {
		countEl.textContent = targets().length;
		render();
	});
	for (const chip of document.querySelectorAll(".chip")) {
		chip.addEventListener("click", () => {
			loginEl.value = chip.textContent;
			loginEl.focus();
			render();
		});
	}

	countEl.textContent = targets().length;
	loginEl.value = "depenbadot";
	render();
	loginEl.focus();
	loginEl.select();
})();
