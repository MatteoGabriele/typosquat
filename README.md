# Typosquat Guard

A GitHub Action that warns when an issue or pull request is opened by an account whose **login imitates a trusted one**: `depenbadot` posing as `dependabot`, `renovate-bot` posing as `renovate[bot]`, `danieleroe` posing as `danielroe`, `yyx990830` posing as `yyx990803`.

Bots are not the only thing worth imitating. A maintainer's name carries as much weight in an issue tracker as a bot's, and often more.

It checks one thing: the login of the author. By default it comments on the thread and labels it, and the job stays green — `mode` chooses the channels, `fail-on-match: true` makes a lookalike fail the job. It blocks nothing else: the judgement is on the reviewer.

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
  issues: write
  pull-requests: write

jobs:
  guard:
    runs-on: ubuntu-latest
    steps:
      - uses: MatteoGabriele/typosquat@35001a02ccc57ce4629df709f97dee74045bffdc
```

That comments on the thread and labels it. The job stays green: the note is
for the reviewer, who decides. To fail the job on a lookalike, add
`with: { fail-on-match: true }`; to say nothing on the thread,
`with: { mode: silent }` — and then `contents: read` is the only permission the
job needs.

## Who it protects

The built-in lists in [`src/trusted.ts`](src/trusted.ts) — `TRUSTED_BOTS` and `TRUSTED_PEOPLE` — plus the repository owner and the repository's contributors.

The maintainer list is a default, not a ranking: a starting set of names whose word carries weight in an issue tracker, so the common impersonations cost something out of the box. Add your own, and use `allow` for anyone the defaults flag by accident:

```yaml
- uses: MatteoGabriele/typosquat@35001a02ccc57ce4629df709f97dee74045bffdc
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
| `mode` | `full` | What to do with a lookalike: `full`, `labels`, `comment` or `silent`. |
| `fail-on-match` | `false` | Whether a lookalike fails the job. |
| `label` | `typosquat:lookalike` | Label added when `mode` includes labelling. |

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
  uses: MatteoGabriele/typosquat@35001a02ccc57ce4629df709f97dee74045bffdc
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

## What it does with a match

Two settings, answering two separate questions. `mode` decides what the thread
is told; `fail-on-match` decides whether the job goes red. They do not talk to
each other: a `silent` run can be asked to fail the job, and a `full` one is
green unless you ask.

| `mode` | What it does |
| --- | --- |
| `full` (default) | Comments on the thread and labels it. |
| `comment` | Comments only. |
| `labels` | Labels only. |
| `silent` | Neither. The outputs and the annotation are all you get. |

The comment is one note per thread: it carries a hidden marker, so a thread
checked ten times is edited, not spammed. The label is `typosquat:lookalike`
unless you set `label`. Anything else — an unknown `mode` — falls back to
`full` and says so in a warning, rather than quietly doing nothing.

Commenting and labelling need the job to grant `issues: write` and
`pull-requests: write`. When they are missing the finding is still reported and
the exit code is unchanged; a warning says the note could not be posted.

Failing is off by default. A lookalike is a thing to look at, not a thing to
block on, and the reviewer is the one who can tell a fork from a fake. When you
do want a red job, ask for it:

```yaml
- uses: MatteoGabriele/typosquat@35001a02ccc57ce4629df709f97dee74045bffdc
  with:
    fail-on-match: true
```

Only an explicit `true` turns failing on, so a typo in the value leaves the run
where it started: reported, and nobody blocked by a mistyped flag.

`mode: silent` with the default `fail-on-match` is watch-only: nothing fails,
nothing is posted, and the outputs still carry the verdict. Start there if you
want to see what your repository actually gets before anything touches a
contributor's thread.

### If you want something in between

The levels above are not a setting; they are what the action reports. `mode` is
deliberately not a dial. When you want to fail on some levels but not others,
leave failing off and decide in the workflow:

```yaml
- id: guard
  uses: MatteoGabriele/typosquat@35001a02ccc57ce4629df709f97dee74045bffdc

- name: Fail on a copied name, tolerate a typo
  if: steps.guard.outputs.risk == 'critical'
  run: exit 1
```

### Coming from `mode: strict` or `mode: warn`

`mode` used to answer the failing question, and the default used to be to
fail. Those values still work and still mean what they meant — `strict` fails,
`warn` does not — but they now set `fail-on-match` and leave the channels on
`full`. The older `fail-on: <level>` is read the same way. The action warns when
it sees either. Replace `mode: strict` with `fail-on-match: true`, and
`mode: warn` with nothing at all.

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
