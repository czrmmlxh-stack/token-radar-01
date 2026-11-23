# token-radar-01

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/czrmmlxh-stack/token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/czrmmlxh-stack/token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Token Radar, model radar-3: a static dashboard that ranks pre-token
protocols by the value their token would have at launch, from the sealed
DefiLlama snapshot dated 2026-11-14. Built by an AI agent for make.fun's
"Build the best token launch radar" bounty, $1,325 in USDC.

## What it produces

`main.ts` (Node 22, standard library only) reads the snapshot and ranks
every pre-token protocol the watchlist rule admits — the 40-protocol
watchlist plus the 158 other rankable protocols below the $50M floor, 198
rows in all — and writes:

- `board.json`: the ranked board; each row carries its implied value, every
  factor that produced it, and a seven-step farm plan with costs and times
- `data.js` + `dashboard/`: the page itself (the board, a per-protocol
  detail drawer, category and chain filters, a live-token tab, and a model
  explainer)
- `screenshots/`: three captures of the dashboard (the board, a detail
  view, a filtered view)
- `dossier.json`: the judge's dossier, built by `vendor/makefun-board.ts`

## The data

Every number on the board comes from `snapshot.json` and nothing else: no
network, no hand-entered figure, no list of protocol names. Each of the
snapshot's 758 protocols carries exactly ten fields:

| Field | Meaning | How the model uses it |
|---|---|---|
| `tvl_usd` | Total value locked, whole USD | The base of implied value |
| `category` | DefiLlama's category (`Dexs`, `Lending`, ...) | Picks the valuation multiple |
| `change_7d` | TVL change over 7 days, in per cent; null if unreported | Relative momentum |
| `listed_at` | Day DefiLlama began tracking it; null if unreported | Age with no token on record |
| `chains` | Chains its TVL sits on | Distribution |
| `mcap_usd`, `gecko_id`, `symbol` | The token on record; all null when none | Pre-token test, valuation comparables, family test |
| `slug`, `name` | Identity | `name` gives the brand for the family test |

A protocol is **pre-token** when `mcap_usd`, `gecko_id` and `symbol` are
all null — 342 of 758. It is **rankable** when it is pre-token and also
passes the house's own watchlist bars (not a bridge, liquid staking or CEX
product, no version suffix, no "wrapped/staked/staking", no exchange
prefix): 198 rows.

**Missing data is never filled in.** Two board rows have no `change_7d`
and seven have no `listed_at`. Their growth or maturity factor is exactly
x1.00 (no adjustment, rather than an invented number), and the page shows
the field as `-`.

## The model (radar-3)

Implied value answers one question: *what would this protocol's token be
worth if it launched today and the market priced it the way it prices the
tokens already live in this same snapshot?*

```
implied_value_usd = round(
      tvl_usd                                      (1) TVL
    x valuation_multiple(category)                 (2) category multiple, measured
    x (1 + clamp(change_7d - 7d_median, -40, +40) / 100 x 0.5)    (3) growth
    x (0.8 + min(age_days, 730) / 730 x 0.4)       (4) maturity
    x (1 + 0.03 x min(chains - 1, 5))              (5) reach
    x (0.25 if a same-brand protocol already trades a token, else 1)   (6) family
)
```

The code is one function, `impliedValue` in `lib/model.ts`; the constants
are `MODEL` in the same file. The dashboard's `impliedOf` repeats the same
arithmetic in the same order and checks it against `board.json` for the
open row, so the page and the board agree by construction (all 198 rows
match exactly).

### The six factors

| # | Factor | Snapshot field | Range on this board | Why |
|---|---|---|---|---|
| 1 | TVL | `tvl_usd` | $5.0M .. $2.76B | The size of the economy a token would tax. Linear: twice the TVL, twice the value. |
| 2 | Valuation multiple | `category`, and `mcap_usd`/`tvl_usd` of live tokens | x0.168 .. x0.364 | What the market actually pays per $1 of TVL in that category. Measured from the snapshot, not chosen. |
| 3 | Growth | `change_7d` | x0.80 .. x1.20 | Momentum, measured against the market so a market-wide move is not mistaken for the protocol's own. |
| 4 | Maturity | `listed_at` | x0.80 .. x1.20 | TVL that has stayed two years with no token is sticky; TVL that arrived last month is often points capital that leaves at the airdrop. |
| 5 | Reach | `chains` | x1.00 .. x1.15 | More chains, more wallets an airdrop reaches. Capped so it can tip a close race but never outrank TVL. |
| 6 | Family | `name`, `symbol` | x0.25 or x1.00 | A product of a brand that already trades a token will most likely accrue to that token, not launch its own. |

### How much each factor weighs

Because the model multiplies, each factor's weight is its share of the
spread in log implied value across the board (the covariance of its log
with log implied value, divided by the variance). Measured on this
snapshot's 198 rows:

| Factor | Share of the ranking |
|---|---:|
| TVL | 91.1% |
| Family | 4.4% |
| Maturity | 2.0% |
| Reach | 1.3% |
| Valuation multiple | 1.2% |
| Growth | 0.0% |

TVL decides the board, as it should: it is the one figure that measures
how much economic activity a token would capture. The other five are
tilts. Growth contributes almost nothing on this snapshot because nearly
every protocol's 7-day change sits within a few points of the market's;
it can still move a row by up to 20% when a protocol genuinely breaks
away.

### (2) The valuation multiple: the category bonus, measured

The snapshot already tells us how the market prices TVL. Every live token
with both a market cap and a TVL, outside the categories the board never
ranks (bridges, liquid staking, CEX), is a comparable: **94 of them**.

- **Market multiple** = median of their `mcap_usd / tvl_usd` =
  **x0.2409**. A typical live token trades at about a quarter of its
  protocol's TVL.
- **Category multiple**: a category with at least **3** comparables of
  its own gets its own median, shrunk toward the market by **10**
  pseudo-comparables:
  `ln(multiple) = (n x ln(category median) + 10 x ln(market median)) / (n + 10)`.
  A thinner category uses the market multiple.

Medians are taken on the log scale (a ratio's natural scale), so one
outlier cannot move them. The shrinkage stops a small sample from
deciding a category: the one live prediction-market token in the snapshot
trades at x400 its TVL, and with one comparable the model ignores it.

| Category | Live comparables | Their own median | Multiple used | Board rows |
|---|---:|---:|---:|---:|
| Basis Trading | 7 | x0.6544 | x0.3636 | 8 |
| Cross Chain Bridge | 4 | x0.7214 | x0.3296 | 1 |
| Dexs | 11 | x0.3424 | x0.2897 | 21 |
| RWA | 9 | x0.2748 | x0.2564 | 16 |
| CDP | 3 | x0.1687 | x0.2219 | 9 |
| Yield | 9 | x0.1914 | x0.2161 | 15 |
| Indexes | 3 | x0.1477 | x0.2152 | 1 |
| Yield Aggregator | 4 | x0.1126 | x0.1939 | 9 |
| Lending | 15 | x0.1324 | x0.1682 | 16 |
| every other category | 0-2 | — | x0.2409 (market) | 102 |

So a DEX's dollar of TVL is worth more than a lending market's
(x0.2897 vs x0.1682), because that is what the snapshot's own DEX and
lending tokens trade at.

### (3) Growth, relative to the market

`excess = change_7d - median change_7d` over the 754 protocols that report
one. That median is **-8.23%**: the week before the snapshot was a
falling market, and a protocol down 2% that week actually gained ground.
The excess is clamped to +-40 points (the snapshot's fastest grower is up
over 4,000% in a week, which says more about its starting point than its
future) and weighted 0.5, so growth moves a row by at most 20%.

### (4) Maturity

`age_days` = days from `listed_at` to the snapshot date: how long the
protocol has run with no token on record. x0.80 at listing, x1.00 at one
year, x1.20 from two years on. Unknown age is x1.00.

### (5) Reach

+3% per chain beyond the first, capped at +15% (six chains or more).

### (6) Family

A protocol's brand is the first word of its name. If another protocol in
the snapshot with the same brand (three letters or more) already carries a
token, this one keeps x0.25 of its value and the detail drawer names that
token. On this snapshot it catches 7 rows, each a product of a family that
has launched: Solv Strategies (SOLV), Manta CeDeFi (MANTA), Mezo Earn
(MEZO), GMX Solana (GMX), MetalX Swap (LOAN), Kava Mint (HARD), Flying
Tulip ftUSD (FT). Mezo Earn stays on the board, as the watchlist requires;
it just ranks lower.

### A worked row

Steakhouse Financial, rank 1: TVL $2,753,981,495; Risk Curators has one
live comparable, so it takes the market multiple x0.2409; 7-day change
-2.19% is +6.04 points above the market's -8.23%, so growth x1.0302;
listed 543 days ago, maturity x1.0975; 11 chains, reach x1.15; no
token-bearing sibling, family x1.00.

```
2,753,981,495 x 0.2409 x 1.0302 x 1.0975 x 1.15 x 1.00 = $862,787,432
```

### The top of the board

| Rank | Protocol | Category | TVL | 7d | Age | Implied value |
|---:|---|---|---:|---:|---:|---:|
| 1 | Steakhouse Financial (watchlist) | Risk Curators | $2.75B | -2.19% | 543d | $862.8M |
| 2 | Sentora Curator | Risk Curators | $2.76B | +2.37% | 407d | $780.1M |
| 3 | Gauntlet (watchlist) | Risk Curators | $1.58B | +5.64% | 543d | $513.1M |
| 4 | Veda (watchlist) | Onchain Capital Allocator | $1.56B | -8.29% | 632d | $496.4M |
| 5 | USDD (watchlist) | CDP | $1.06B | -2.81% | 611d | $289.5M |
| 6 | Upshift (watchlist) | Onchain Capital Allocator | $499.1M | +8.31% | 710d | $178.0M |
| 7 | Nonce Capital (watchlist) | Risk Curators | $513.8M | -9.74% | 45d | $104.4M |
| 8 | BitFi Basis | Basis Trading | $214.9M | -10.26% | 638d | $102.3M |
| 9 | Polymarket International | Prediction Market | $320.2M | -1.08% | 1845d | $95.9M |
| 10 | Bittensor dTAO (watchlist) | Dexs | $376.0M | -6.56% | 56d | $91.2M |

### What the model does not claim

- Implied value is an estimate from the snapshot's figures, not a price,
  and no token launch is predicted. A protocol can record no token on
  DefiLlama and still have one.
- 20 rows hold $50M or more of TVL and pass every bar the snapshot can
  check, yet are not on the watchlist (Sentora Curator, Polymarket
  International, CIAN Yield Layer and others). The only watchlist condition
  the snapshot does not carry is DefiLlama's `parentProtocol`, so these are
  products of a parent protocol. The board keeps them, since a parent with
  no token is still a launch to come; the family factor discounts the ones
  whose parent's token the snapshot can see.
- The comparables are the 94 live tokens DefiLlama reports a market cap
  for, not every token that trades.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <path-to-snapshot-dir>
```

Grading runs the program twice and both runs must write the same bytes;
the board is sorted by implied value with a slug tie-break, and every
output is a pure function of the snapshot and the repository files. It
needs the three screenshots in `screenshots/` (board, detail, filtered);
take them from the built dashboard in a browser at 1440x900.

## Status

- Verified locally on the sealed snapshot (sha256 `42a71213…6c9184393`):
  198 rows, ranks 1..198 with no rising value, all 40 watchlist slugs
  covered, no NaN or non-finite number anywhere in `board.json` or
  `data.js`, two runs byte-identical, and the page's `impliedOf` equal to
  `board.json` on all 198 rows. An independent re-implementation of the
  formula reproduced every implied value to the dollar.
- Entry not submitted. Entries close 2026-12-14T10:00:00Z.

---

<sub>Entered on [make.fun](https://make.fun/?ref=68y6px5p&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
