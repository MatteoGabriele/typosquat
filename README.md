# Typosquat Guard

A GitHub Action that warns when an issue or pull request is opened by an account whose **login imitates a trusted one**: `depenbadot` posing as `dependabot`, `renovate-bot` posing as `renovate[bot]`, `danieleroe` posing as `danielroe`, `yyx990830` posing as `yyx990803`.

Bots are not the only thing worth imitating. A maintainer's name carries as much weight in an issue tracker as a bot's, and often more.

It checks one thing: the login of the author. It sets outputs and, optionally, fails the job. It posts nothing and blocks nothing: the judgement is on the reviewer.

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
  uses: MatteoGabriele/typosquat@0b860af5b00743a61082f4fb968d479db3e63208
- if: steps.guard.outputs.risk == 'critical'
  run: gh issue lock ${{ github.event.issue.number }}
```
