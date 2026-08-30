# Typosquat Guard

A GitHub Action that warns when an issue or pull request is opened by an account whose **login imitates a trusted one** — `depenbadot` posing as `dependabot`, `renovate-bot` posing as `renovate[bot]`, `danieleroe` posing as `danielroe`, `yyx990830` posing as `yyx990803`.

Bots are not the only thing worth imitating. A maintainer's name carries as much weight in an issue tracker as a bot's, and often more.

It checks one thing: the login of the author. It sets outputs and, optionally, fails the job. It posts nothing and blocks nothing — the judgement stays with a human.

```
::warning::depenbadot resembles dependabot[bot] - two characters swapped (high, 76/100).
```

## Quick start

```yaml
name: Typosquat Guard

on:
  issues:
    types: [opened]
  pull_request_target:
    types: [opened, reopened]

permissions:
  contents: read

jobs:
  guard:
    runs-on: ubuntu-latest
    steps:
      - uses: MatteoGabriele/typosquat@v1
```

No build step, no `node_modules`, and a single API call to list contributors.

## The threat it addresses

GitHub logins are unique but not exclusive of their neighbourhood. `dependabot` is taken; `dependab0t`, `depend-a-bot` and `depenbadot` are not. An account with a copied avatar and a near-identical name posting *"⚠️ security advisory: run `npm i -g our-patch-cli`"* on your issue tracker reads as routine bot noise to a maintainer skimming notifications.

The same trick works on people, and the reader has less to go on. `danielroe` is taken, `danieleroe` is not. Worse, plenty of well-known maintainers have logins that carry no meaning at all — `yyx990803`, `43081j`. Those are the easiest of all to copy, because there is no word to compare against: nobody spots that `yyx990830` has two digits transposed. The action treats such **opaque** logins as a distinct case, widening the net around them and scoring matches higher (see below).

One structural fact does most of the work:

> A GitHub login may only contain `[A-Za-z0-9-]`, with single hyphens, no leading or trailing hyphen, max 39 characters.

Two consequences:

1. **Unicode homoglyph attacks are impossible in logins.** A Cyrillic `а` cannot appear in a username, so the folds here are all ASCII.
2. **The `[bot]` suffix cannot be forged.** `[` and `]` are illegal in a login, so `dependabot[bot]` is unregisterable by a human. That is why impersonators reach for the *bare* name or a bot-ish suffix instead — and why an author whose login ends in `[bot]` is passed over without a check.

## What it detects

| Rule | Example against `dependabot[bot]` | Score |
| --- | --- | --- |
| `bot-base-name-squat` | `dependabot` — the bare name of a GitHub App | 88 |
| `digit-substitution` | `dependab0t`, `d3p3ndab07` | 84 |
| `bot-affix-variant` | `renovate-bot` against `renovate[bot]` | 82 |
| `authority-affix` | `danielroe-official`, `real-danielroe`, `dependabot-security` | 80 |
| `separator-variant` | `depend-a-bot`, `depend_a_bot` | 80 |
| `digraph-lookalike` | `rn` read as `m`, `vv` as `w`, `cl` as `d` | 78 |
| `single-character-edit` | `dependabor` | 76 |
| `character-swap` | `depenbadot` — two characters swapped | 76 |
| `doubled-character` | `dependabbot` | 72 |
| `affix-wrap` | `dependabot-mirror`, `nightly-dependabot` | 62 |
| `near-miss` | two edits away, for names of 8+ characters | 58 |

`authority-affix` is the one rule that reads the *meaning* of the extra word rather than its shape: `official`, `real`, `the`, `verified`, `hq`, `team`, `dev`, `support`, `security` and friends, stripped from either end of either login. `danielroe-official` and `real-danielroe` are both claims about `danielroe`; `danielroe-mirror` is only a wrap, and scores as one.

The strongest match wins. Scores band into `low` (20) → `medium` (40) → `high` (60) → `critical` (80). Names under 4 characters are never defended, because everything looks like them.

### Opaque logins

A login with no readable structure — a third or more of it digits, a run of three digits, or no vowels at all — cannot be checked by eye. `yyx990803` and `43081j` qualify; `danielroe` and `TkDodo` do not. Two adjustments follow:

- **+8 to the score** on every tight rule, so `yyx990830` lands at 84/critical where `danieleroe` lands at 76/high. Both are one edit away; only one of them a reader would catch.
- **`near-miss` applies from 5 characters** instead of 8. A two-edit collision between short readable words is common; between short opaque strings it is not.

The two loose rules, `near-miss` and `affix-wrap`, already tolerate distance and do not take the bonus on top.

## Who it protects

The built-in lists in [`src/trusted.ts`](src/trusted.ts) — `TRUSTED_BOTS` and `TRUSTED_PEOPLE` — plus the repository owner and the repository's contributors.

The maintainer list is a default, not a ranking: a starting set of names whose word carries weight in an issue tracker, so the common impersonations cost something out of the box. Add your own, and use `allow` for anyone the defaults flag by accident:

```yaml
- uses: MatteoGabriele/typosquat@v1
  with:
    protect: |
      acme-release-bot
      acme-security
      our-lead-maintainer
    allow: our-legitimately-similar-fork-bot
```

## Inputs

| Input | Default | Description |
| --- | --- | --- |
| `github-token` | `${{ github.token }}` | Token used to list contributors. |
| `protect` | — | Extra logins to defend, comma- or newline-separated. |
| `allow` | — | Logins that are never flagged. |
| `fail-on` | `never` | Fail the job at this severity or above. |

## Outputs

| Output | Description |
| --- | --- |
| `actor` | The login that was checked. |
| `risk` | `none`, `low`, `medium`, `high` or `critical`. |
| `score` | 0–100 confidence of the match. |
| `resembles` | The protected login the author resembles, empty when there is no match. |
| `rule` | Which rule matched, empty when there is no match. |

```yaml
- id: guard
  uses: MatteoGabriele/typosquat@v1
- if: steps.guard.outputs.risk == 'critical'
  run: gh issue lock ${{ github.event.issue.number }}
```

## What it does not do

- **It does not verify identity.** Every signal is a resemblance heuristic. A legitimate contributor can share a name shape with a bot, and a determined impersonator can pick a name far enough away to slip through.
- **It does not check display names, commits, comment bodies or avatars.** Only the author's login.
- **It does not catch a stem hijack.** `patak-mail` against `patak-dev` shares only a first word, and flagging that would flag every account that happens to start with a common name.
- **It does not comment, label or lock.** Wire that up yourself from the outputs.

Treat it as a tripwire that makes a maintainer look twice, not as an authorisation boundary.

## Playground

`playground/` is a single page for trying the rules by hand — type a login, see
which protected identity it imitates, which rule fired, and how the two names
line up character by character.

```bash
pnpm playground
```

One command: it builds the rules, serves the page, opens your browser, and
reloads it whenever you edit something in `src/`.

## Development

```bash
pnpm install
pnpm test        # vitest
pnpm typecheck   # tsc --noEmit
pnpm check       # biome lint + format
pnpm build       # tsdown -> dist/index.mjs
pnpm playground  # build + serve the playground on :4173
```

TypeScript in [src/](src/), no runtime dependencies. [`src/text.ts`](src/text.ts) holds the folds, [`src/distance.ts`](src/distance.ts) the edit-distance metrics, [`src/check.ts`](src/check.ts) the rules and scoring, [`src/trusted.ts`](src/trusted.ts) the default bots and maintainers, and [`src/index.ts`](src/index.ts) the event plumbing.

`tsdown` bundles that into a single dependency-free ESM file, `dist/index.mjs`, which is what `action.yml` runs on `node20`. **The bundle is committed**: rebuild it with `pnpm build` and include `dist/` in any pull request that touches `src/`, or CI will fail.

## License

MIT
