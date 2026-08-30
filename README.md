# Typosquat Guard

A GitHub Action that warns when an issue or pull request is opened by an account whose **login imitates a trusted one**: `depenbadot` posing as `dependabot`, `renovate-bot` posing as `renovate[bot]`, `danieleroe` posing as `danielroe`, `yyx990830` posing as `yyx990803`.

Bots are not the only thing worth imitating. A maintainer's name carries as much weight in an issue tracker as a bot's, and often more.

It checks one thing: the login of the author. By default it fails the job on any lookalike; `mode: warn` reports without failing. It posts nothing and blocks nothing else: the judgement is on the reviewer.

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
      - uses: MatteoGabriele/typosquat@0b860af5b00743a61082f4fb968d479db3e63208
```

That fails the job on any lookalike. To watch first and fail later, add
`with: { mode: warn }` — the outputs and the warning are the same either way.

## Who it protects

The built-in lists in [`src/trusted.ts`](src/trusted.ts) — `TRUSTED_BOTS` and `TRUSTED_PEOPLE` — plus the repository owner and the repository's contributors.

The maintainer list is a default, not a ranking: a starting set of names whose word carries weight in an issue tracker, so the common impersonations cost something out of the box. Add your own, and use `allow` for anyone the defaults flag by accident:

```yaml
- uses: MatteoGabriele/typosquat@0b860af5b00743a61082f4fb968d479db3e63208
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
| `mode` | `strict` | `strict` fails the job on any lookalike. `warn` only annotates. |

## Outputs

| Output | Description |
| --- | --- |
| `actor` | The login that was checked. |
| `risk` | How likely the name is a fake: `none`, `low`, `medium`, `high` or `critical`. |
| `score` | 0–100. A tiebreaker; use `risk` to decide. |
| `resembles` | The protected login the author resembles, empty when there is no match. |
| `rule` | Which rule matched, empty when there is no match. |

```yaml
- id: guard
  uses: MatteoGabriele/typosquat@0b860af5b00743a61082f4fb968d479db3e63208
- if: steps.guard.outputs.risk == 'critical'
  run: gh issue lock ${{ github.event.issue.number }}
```

## What the levels mean

One question decides the level: **could someone land on this name by accident?**

| Risk | In plain words | What to do |
| --- | --- | --- |
| `critical` | The name was copied. Nobody types this by accident. | Treat the author as an impersonator. |
| `high` | One slip away from the real name. Could be a typo, could be a fake. | Look at the account before you trust it. |
| `medium` | The real name with extra words around it, like `dependabot-mirror`. Forks and mirrors look like this too. | Glance at it. Usually fine. |
| `low` | Vaguely similar, two characters off. | Nothing, unless you are strict. |
| `none` | Not similar to anything protected. | Nothing. |

That is the whole ladder: the higher it goes, the harder it is to believe the
resemblance is a coincidence.

Every match writes one warning line that says the same thing in words:

```
CRITICAL: dependab0t looks like dependabot[bot] (letters replaced by lookalike
digits). Copied on purpose. Nobody types this name by accident.
```

## The two modes

There is one setting, and it answers one question: should a lookalike stop the
job?

| `mode` | What it does |
| --- | --- |
| `strict` (default) | A lookalike fails the job. |
| `warn` | Nothing ever fails. The match is still reported. |

```yaml
- uses: MatteoGabriele/typosquat@0b860af5b00743a61082f4fb968d479db3e63208
  with:
    mode: warn
```

Start on `warn` if you want to see what your repository actually gets before
anything blocks a contributor. The outputs and the warning annotation are
identical in both modes, so switching one to the other changes nothing except
whether the job goes red.

Anything other than `warn` is treated as `strict`, so a typo in the value cannot
quietly turn the guard off.

### If you want something in between

The levels above are not a setting; they are what the action reports. `mode` is
deliberately not a dial. When you want a middle ground, use `warn` and decide in
the workflow:

```yaml
- id: guard
  uses: MatteoGabriele/typosquat@0b860af5b00743a61082f4fb968d479db3e63208
  with:
    mode: warn

- name: Fail on a copied name, tolerate a typo
  if: steps.guard.outputs.risk == 'critical'
  run: exit 1
```

## Which rule matched

Every match also names the rule that fired, so a workflow can treat a copied
name differently from a plausible typo. The rules are tried strongest first and
the first hit wins, so what you get is the strongest thing that can be said
about a login. When an author resembles two protected logins, the higher one
wins.

| Rule | Risk | Catches | Example |
| --- | --- | --- | --- |
| `bot-base-name-squat` | critical | The bare name of a GitHub App, registered as a human account. A login cannot contain `[` or `]`, so this is always a different account. | `dependabot` → `dependabot[bot]` |
| `digit-substitution` | critical | Letters replaced by lookalike digits. | `dependab0t` → `dependabot[bot]` |
| `bot-affix-variant` | critical | A hand-made bot suffix on a real bot's name. | `renovate-bot` → `renovate[bot]` |
| `authority-affix` | critical | A word claiming to be the official, real or personal account. | `the-real-danielroe` → `danielroe` |
| `separator-variant` | critical | The same name with hyphens or underscores added, removed or moved. | `depend-a-bot` → `dependabot[bot]` |
| `digraph-lookalike` | critical | Multi-character lookalikes: `rn` for `m`, `vv` for `w`, `cl` for `d`. | `tarnerlinsley` → `tannerlinsley` |
| `doubled-character` | high | A character doubled or de-doubled. | `dependabbot` → `dependabot[bot]` |
| `single-character-edit` | high | One character added, removed or changed. | `danieleroe` → `danielroe` |
| `character-swap` | high | Two characters trading places. | `depenbadot` → `dependabot[bot]` |
| `affix-wrap` | medium | The protected name wrapped in extra words, up to 8 characters of them. | `dependabot-mirror` → `dependabot[bot]` |
| `near-miss` | low | Two characters away. Needs a name of 8 characters or more to stay quiet. | `4308ik` → `43081j` |

### Names you cannot read

`yyx990803` and `43081j` are perfectly real logins, and there is no word to
compare them against, so a one-character change hides in plain sight. When the
protected name looks like that, the match counts **one level higher**: a
`single-character-edit` is reported as `critical` instead of `high`.

`near-miss` and `affix-wrap` are already loose nets and are left alone.

### The score

Ignore it unless you need it. `risk` is the decision; `score` is the same
ranking as a number (`low` ≈ 30, `medium` ≈ 50, `high` ≈ 70, `critical` ≈ 90)
and exists only to pick a winner when an author resembles two protected logins
at once.

Protected logins shorter than 4 characters are skipped, and an exact match on a
person's login is the person, not an impersonation.
