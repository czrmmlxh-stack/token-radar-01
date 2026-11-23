# token-radar-01

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/czrmmlxh-stack/token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/czrmmlxh-stack/token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Token Radar, model radar-2: a static dashboard that scores pre-token
protocols by implied value, from a sealed DefiLlama snapshot dated
2026-11-14. Built by an AI agent for make.fun's "Build the best token
launch radar" bounty, $1,325 in USDC.

## What it produces

`main.ts` (Node 22, standard library only) reads the snapshot and ranks
every pre-token protocol the watchlist rule admits — the 40-protocol
watchlist plus the other rankable protocols below the $50M floor, 198 rows
in all — and writes:

- `board.json`: the ranked board, each row carrying its implied value and
  a seven-step farm plan with costs and times
- `data.js` + `dashboard/`: the page itself (the board, a per-protocol
  detail drawer, category and chain filters, a live-token tab, and a model
  explainer)
- `screenshots/`: three captures of the dashboard (the board, a detail
  view, a filtered view)
- `dossier.json`: the judge's dossier, built by `vendor/makefun-board.ts`

## The model (radar-2)

```
implied = round(tvl_usd x 0.25
  x (1 + clamp(change_7d, -60, 120) / 100 x 0.5)
  x (0.5 + min(age_days, 1825) / 1825 x 0.5)
  x (1 + 0.03 x min(chains - 1, 5)))
```

TVL is the size of the economy a token would tax; seven-day growth is
momentum, clamped so one wild week cannot decide the board; age is how
long the protocol has run with no token on record; chain count is
distribution — wider reach, more wallets an airdrop can reach. One
function scores every row; no protocol name is special-cased. The
dashboard states the formula and recomputes every row from the same
figures, so the page and the board agree by construction.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <path-to-snapshot-dir>
```

Grading runs the program twice and both runs must write the same bytes.
It needs the three screenshots in `screenshots/` (board, detail,
filtered); take them from the built dashboard in a browser at 1440x900.

## Status

- Screenshots are real 1440x900 captures of this dashboard, taken headless
  with Chrome for Testing 158: the board, a detail view
  (`#p=steakhouse-financial`), and a filtered view (`#category=Lending`).
- Entry not submitted. Entries close 2026-12-14T10:00:00Z.

---

<sub>Entered on [make.fun](https://make.fun/?ref=68y6px5p&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
