// Token Radar, model radar-3.
//
// What the board is: every pre-token protocol in the sealed snapshot that
// the house's own watchlist rule would admit — the watchlist itself (the
// floor) plus every other rankable protocol below the floor. "Pre-token"
// means the record carries no token at all: no market cap, no CoinGecko id,
// no symbol. The snapshot records that absence; it never proves a protocol
// has no token, and the board says the same thing in its detail drawer.
//
// One function, impliedValue, scores every row from the snapshot's own
// figures. Implied value answers one question: what would this protocol's
// token be worth if it launched today and the market priced it the way it
// prices the tokens already live in this same snapshot?
//
//   implied = round( tvl_usd                                  TVL: the economy a token would tax
//                  x valuation_multiple(category)             what the market pays per $1 of TVL
//                  x growth(change_7d - market change_7d)     relative momentum      0.80x .. 1.20x
//                  x maturity(age_days)                       durability of the TVL  0.80x .. 1.20x
//                  x reach(chains)                            distribution           1.00x .. 1.15x
//                  x family(name) )                           0.25x when a same-brand protocol already trades a token
//
// 1. TVL is the base, linear: twice the TVL is twice the implied value.
// 2. The valuation multiple is measured, not chosen. Every live token in the
//    snapshot that carries both a market cap and a TVL is a comparable; the
//    multiple is the median of their mcap / TVL (taken on the log scale, so
//    one 400x outlier moves nothing). A category with at least
//    min_category_comps comparables of its own gets its own median, shrunk
//    toward the market's by prior_weight pseudo-comparables; a thinner
//    category gets the market's. This is the category bonus or discount:
//    a Dexs protocol is priced like the snapshot's live DEX tokens, a
//    Lending protocol like its lending tokens, and nothing else.
// 3. Growth is the protocol's seven-day TVL change minus the snapshot's
//    median seven-day change, so a market-wide move (the price of ETH) is not
//    mistaken for the protocol's own momentum. Clamped to +-40 points and
//    weighted 0.5, it tilts the value by at most 20% either way.
// 4. Maturity is how long DefiLlama has tracked the protocol with no token
//    on record. TVL that has stayed for two years is sticky; TVL that arrived
//    last month is often points-farming capital that leaves at the airdrop.
//    0.80x at listing, 1.00x at one year, 1.20x from two years on.
// 5. Reach is the number of chains: more chains, more wallets an airdrop
//    reaches. +3% per extra chain, capped at +15%, so it tips close races
//    and never outranks TVL.
// 6. Family: a protocol whose brand (the first word of its name) is shared
//    by a protocol in the snapshot that already trades a token is a product
//    of a family that has launched. Its value most likely accrues to that
//    token, so it keeps a quarter of its value and the drawer names the
//    token.
//
// A missing input is never filled in: a protocol with no seven-day change
// or no listing date gets x1.00 on that factor (no adjustment), and the page
// shows the field as "-". No protocol name is ever special-cased. The
// dashboard states the formula and recomputes every row from the same
// figures, so the page and the board agree by construction.

/** One protocol, exactly the ten fields the sealed snapshot carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** radar-3's constants, as the dashboard states them. */
export interface ModelConstants {
  /** A category needs this many live-token comparables before its own median counts. */
  min_category_comps: number;
  /** How many market-wide pseudo-comparables a category's median is shrunk toward. */
  prior_weight: number;
  growth_weight: number;
  growth_floor: number;
  growth_cap: number;
  maturity_floor: number;
  maturity_range: number;
  maturity_days: number;
  chain_step: number;
  chain_max_bonus: number;
  family_multiplier: number;
  /** A brand shorter than this many letters is too generic to tie two protocols together. */
  family_brand_min: number;
}

export const MODEL: ModelConstants = {
  min_category_comps: 3,
  prior_weight: 10,
  growth_weight: 0.5,
  growth_floor: -40,
  growth_cap: 40,
  maturity_floor: 0.8,
  maturity_range: 0.4,
  maturity_days: 730,
  chain_step: 0.03,
  chain_max_bonus: 5,
  family_multiplier: 0.25,
  family_brand_min: 3,
};

/** The model's version label: the dashboard names it. */
export const MODEL_VERSION = 'radar-3';

/** How many live-token protocols the Live tab carries, by market cap. */
export const LIVE_ROWS = 30;

/** One category's valuation multiple and the evidence behind it. */
export interface CategoryValuation {
  category: string;
  /** Live-token comparables in the category. */
  comps: number;
  /** Their own median mcap / TVL, or null when the category has none. */
  median_multiple: number | null;
  /** The multiple the model applies to the category's TVL. */
  multiple: number;
  basis: 'category' | 'market';
}

/** What the snapshot's live tokens say about pricing: the model's market inputs. */
export interface Market {
  /** Live-token comparables: a market cap above zero, a TVL above zero, not a blocked category. */
  comps: number;
  /** Their median mcap / TVL. */
  multiple: number;
  /** The median seven-day TVL change over every protocol that reports one. */
  change_7d: number;
  change_7d_count: number;
  /** One entry per category the board ranks. */
  categories: CategoryValuation[];
}

/** A same-brand protocol that already trades a token. */
export interface FamilyToken {
  slug: string;
  name: string;
  symbol: string;
}

/** One row of board.json. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  model: {
    valuation_multiple: number;
    valuation_basis: 'category' | 'market';
    valuation_comps: number;
    growth_excess_pct: number | null;
    growth_multiplier: number;
    maturity_multiplier: number;
    chains_multiplier: number;
    family_multiplier: number;
    family_token: FamilyToken | null;
    age_days: number | null;
  };
  farm_steps: string[];
}

/** The dashboard's compact view of one row. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  valuation_multiple: number;
  valuation_basis: 'category' | 'market';
  valuation_comps: number;
  growth_multiplier: number;
  maturity_multiplier: number;
  chains_multiplier: number;
  family_multiplier: number;
  family_token: FamilyToken | null;
  watchlist: boolean;
}

/** A live-token protocol: it already trades, so the board shows the market's own value. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

/** Everything the dashboard renders. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  market: Market;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  rows: RadarRow[];
  live: LiveRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const MS_PER_DAY = 86_400_000;
const round4dp = (n: number): number => Math.round(n * 1e4) / 1e4;
const byCodeUnit = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** The median of a non-empty list: the middle value, or the mean of the middle two. */
function median(values: number[]): number {
  const sorted = values.slice().sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** Whole days from `listedAt` to `asOf`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const start = Date.parse(`${asOf}T00:00:00Z`);
  const listed = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(listed)) return null;
  return Math.max(0, Math.floor((start - listed) / MS_PER_DAY));
}

/** A name ending in a release marker is a pool of another protocol, not a protocol of its own. */
const VERSION_SUFFIX = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** Categories that are a wrapped, staked or bridged product of a token that already trades. */
const BLOCKED_CATEGORIES = new Set(['Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC', 'CEX']);

/** Exchanges whose named products are their own token's wrapper, not a new protocol. */
const EXCHANGE_BRANDS = ['Binance', 'Coinbase', 'Bybit', 'Kraken', 'Bitget', 'OKX', 'Bitfinex', 'Gemini'];

/** A whole word that marks a product as wrapped or staked. */
const WRAP_WORD = /\b(wrapped|staked|staking)\b/i;

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

// ---- The market: what the snapshot's live tokens say a dollar of TVL is worth ----

/** Whether a protocol prices the board: a live token with a market cap and a TVL, in a category the board could rank. */
function isComparable(p: SnapshotProtocol): boolean {
  return p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0 && (p.category === null || !BLOCKED_CATEGORIES.has(p.category));
}

/**
 * The market inputs, from the snapshot alone: the median mcap / TVL of its
 * live tokens, each listed category's own multiple, and the median seven-day
 * TVL change. Medians are taken on the log scale for multiples (a ratio's
 * natural scale), so a category's median is the geometric middle of its
 * comparables and one outlier cannot move it.
 */
export function marketOf(snapshot: Snapshot, categories: string[], model: ModelConstants = MODEL): Market {
  const comps = snapshot.protocols.filter(isComparable);
  if (comps.length === 0) {
    throw new SnapshotError('the snapshot holds no live token with both a market cap and a TVL, so nothing prices the board');
  }
  const logMultiple = (p: SnapshotProtocol): number => Math.log(p.mcap_usd! / p.tvl_usd);
  const marketLog = median(comps.map(logMultiple));
  const logsByCategory = new Map<string, number[]>();
  for (const p of comps) {
    if (p.category === null) continue;
    const logs = logsByCategory.get(p.category) ?? [];
    logs.push(logMultiple(p));
    logsByCategory.set(p.category, logs);
  }
  const listed = Array.from(new Set(categories)).sort(byCodeUnit);
  const valuations: CategoryValuation[] = listed.map((category) => {
    const logs = logsByCategory.get(category) ?? [];
    const n = logs.length;
    const own = n > 0 ? median(logs) : null;
    const useOwn = own !== null && n >= model.min_category_comps;
    const log = useOwn ? (n * own + model.prior_weight * marketLog) / (n + model.prior_weight) : marketLog;
    return {
      category,
      comps: n,
      median_multiple: own === null ? null : round4dp(Math.exp(own)),
      multiple: Math.exp(log),
      basis: useOwn ? 'category' : 'market',
    };
  });
  const changes = snapshot.protocols.map((p) => p.change_7d).filter((c): c is number => c !== null);
  return {
    comps: comps.length,
    multiple: Math.exp(marketLog),
    // With no protocol reporting a change, every row's growth is x1.00 anyway.
    change_7d: changes.length > 0 ? median(changes) : 0,
    change_7d_count: changes.length,
    categories: valuations,
  };
}

// ---- Families: a product of a brand whose token already trades ----

/** A protocol's brand: the first word of its name, lower-cased. */
function brandOf(name: string): string {
  return name.trim().toLowerCase().split(/[\s\-_.]+/)[0] ?? '';
}

/** Every brand in the snapshot that already trades a token, mapped to its largest such protocol by TVL. */
export function tokenFamilies(snapshot: Snapshot, model: ModelConstants = MODEL): Map<string, FamilyToken> {
  const families = new Map<string, FamilyToken>();
  const live = snapshot.protocols
    .filter((p) => !isPreToken(p))
    .sort((a, b) => b.tvl_usd - a.tvl_usd || byCodeUnit(a.slug, b.slug));
  for (const p of live) {
    const brand = brandOf(p.name);
    if (brand.length < model.family_brand_min || families.has(brand)) continue;
    families.set(brand, { slug: p.slug, name: p.name, symbol: p.symbol ?? p.gecko_id ?? 'its token' });
  }
  return families;
}

/** Every factor one protocol gets under `model`, and the implied value they multiply to. */
export interface Factors {
  implied: number;
  multiple: number;
  basis: 'category' | 'market';
  comps: number;
  growthExcess: number | null;
  growthMult: number;
  maturityMult: number;
  chainsMult: number;
  familyMult: number;
  family: FamilyToken | null;
  age: number | null;
}

/** The six factors and the implied value one protocol gets under `model`. */
export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  market: Market,
  families: Map<string, FamilyToken>,
  model: ModelConstants,
): Factors {
  const age = ageDays(asOf, protocol.listed_at);
  const valuation = market.categories.find((c) => c.category === protocol.category) ?? null;
  const multiple = valuation === null ? market.multiple : valuation.multiple;
  const growthExcess =
    protocol.change_7d === null ? null : Math.min(model.growth_cap, Math.max(model.growth_floor, protocol.change_7d - market.change_7d));
  const growthMult = growthExcess === null ? 1 : 1 + (growthExcess / 100) * model.growth_weight;
  const maturityMult = age === null ? 1 : model.maturity_floor + (Math.min(age, model.maturity_days) / model.maturity_days) * model.maturity_range;
  const extraChains = Math.min(Math.max(protocol.chains.length - 1, 0), model.chain_max_bonus);
  const chainsMult = 1 + model.chain_step * extraChains;
  const sibling = families.get(brandOf(protocol.name)) ?? null;
  const family = sibling !== null && sibling.slug !== protocol.slug ? sibling : null;
  const familyMult = family === null ? 1 : model.family_multiplier;
  // The page's impliedOf multiplies in this same order, so both write the same number.
  const implied = Math.max(1, Math.round(protocol.tvl_usd * multiple * growthMult * maturityMult * chainsMult * familyMult));
  return {
    implied,
    multiple,
    basis: valuation === null ? 'market' : valuation.basis,
    comps: valuation === null ? 0 : valuation.comps,
    growthExcess,
    growthMult,
    maturityMult,
    chainsMult,
    familyMult,
    family,
    age,
  };
}

// Every bar a protocol must clear to be ranked: it records no token, it is
// not a wrapped, staked or bridged product of a token that already trades,
// it is not in a blocked category, it does not end in a version marker, it
// carries no whole word wrapped, staked or staking, and it does not begin
// with an exchange's name. WBTC, Binance staked ETH and USDT0 are off the
// board for the same reason they are off the watchlist: each is a wrapped
// or staked product of a token that already trades, so ranking one as a
// pre-token protocol to farm would be the board lying about what it is.
const RANK_BARS: Array<(p: SnapshotProtocol) => boolean> = [
  (p) => isPreToken(p),
  (p) => p.category === null || !BLOCKED_CATEGORIES.has(p.category),
  (p) => !VERSION_SUFFIX.test(p.name),
  (p) => !WRAP_WORD.test(p.name),
  (p) => !EXCHANGE_BRANDS.some((brand) => p.name.startsWith(brand)),
];

/** Whether the board may rank a protocol: the house's own watchlist rule, without the TVL floor. */
export function isRankable(p: SnapshotProtocol): boolean {
  return RANK_BARS.every((bar) => bar(p));
}

/** The board and the market it was priced against: every rankable protocol, strongest implied value first, ranks 1..n. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; market: Market } {
  const chosen = snapshot.protocols.filter((p) => isRankable(p));
  // The watchlist is the floor: if a watchlist slug were somehow unrankable
  // (it is not in this snapshot), the board would still be wrong without it,
  // so refuse loudly instead of silently dropping a row the gate requires.
  const chosenSlugs = new Set(chosen.map((p) => p.slug));
  const missing = snapshot.watchlist.filter((slug) => !chosenSlugs.has(slug));
  if (missing.length > 0) {
    throw new SnapshotError(`watchlist slugs the board cannot rank: ${missing.join(', ')}`);
  }
  const market = marketOf(
    snapshot,
    chosen.map((p) => p.category).filter((c): c is string => c !== null),
    model,
  );
  const families = tokenFamilies(snapshot, model);
  const scored = chosen.map((p) => ({ p, v: impliedValue(p, snapshot.as_of, market, families, model) }));
  // Sort by implied value, then by slug: the tie-break is fixed so two runs
  // of the program write the same bytes.
  scored.sort((a, b) => b.v.implied - a.v.implied || byCodeUnit(a.p.slug, b.p.slug));
  const board = scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token' as const,
    age_days: s.v.age,
    implied_value_usd: s.v.implied,
    model: {
      valuation_multiple: round4dp(s.v.multiple),
      valuation_basis: s.v.basis,
      valuation_comps: s.v.comps,
      growth_excess_pct: s.v.growthExcess === null ? null : round4dp(s.v.growthExcess),
      growth_multiplier: round4dp(s.v.growthMult),
      maturity_multiplier: round4dp(s.v.maturityMult),
      chains_multiplier: round4dp(s.v.chainsMult),
      family_multiplier: s.v.familyMult,
      family_token: s.v.family,
      age_days: s.v.age,
    },
    farm_steps: farmSteps(s.p, s.v.age).map(stepText),
  }));
  return { board, market };
}

/** The live-token protocols, by market cap, for the dashboard's Live tab. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
    }));
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const { board, market } = buildBoard(snapshot, model);
  const live = liveRows(snapshot);
  const watchlist = new Set(snapshot.watchlist);
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    market,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: board.filter((r) => !watchlist.has(r.slug)).length,
    live_size: live.length,
    rows: board.map((row) => ({
      rank: row.rank,
      slug: row.slug,
      name: row.name,
      category: row.category,
      chains: row.chains,
      tvl_usd: row.tvl_usd,
      change_7d: row.change_7d,
      mcap_usd: row.mcap_usd,
      listed_at: row.listed_at,
      age_days: row.age_days,
      implied_value_usd: row.implied_value_usd,
      valuation_multiple: row.model.valuation_multiple,
      valuation_basis: row.model.valuation_basis,
      valuation_comps: row.model.valuation_comps,
      growth_multiplier: row.model.growth_multiplier,
      maturity_multiplier: row.model.maturity_multiplier,
      chains_multiplier: row.model.chains_multiplier,
      family_multiplier: row.model.family_multiplier,
      family_token: row.model.family_token,
      watchlist: watchlist.has(row.slug),
    })),
    live,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) {
    throw new SnapshotError('snapshot.json has no floor_usd');
  }
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) {
    throw new SnapshotError('snapshot.json has no watchlist of slugs');
  }
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  // Two rows with one slug would rank the same protocol twice, so refuse a
  // snapshot that repeats one instead of silently building a wrong board.
  const seenSlugs = new Set<string>();
  for (const p of protocols) {
    if (seenSlugs.has(p.slug)) throw new SnapshotError(`snapshot.json repeats the slug ${p.slug}`);
    seenSlugs.add(p.slug);
  }
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  if (board.length < 100 || board.length > 4000) return `board holds ${board.length} rows, the gate takes 100 to 4000`;
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) {
    return `row ${i + 1} outranks row ${i} on implied value`;
  }
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
    if (r.farm_steps.length < 3 || r.farm_steps.length > 12) return `${r.slug} has ${r.farm_steps.length} farm steps`;
    for (const s of r.farm_steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}

// ---- Farm plans (derived from the protocol's own record, never from a list of names) ----

/** One farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** A step as one string: action, then cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 250;
  if (p.tvl_usd >= 1_000_000_000) return 150;
  if (p.tvl_usd >= 100_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

// One entry per kind of protocol the snapshot holds: the words that pick it
// out of a lower-cased category, in the order they are tried, and the action
// its farmer takes. The order is the rule — the first entry whose words
// appear wins — so a category that mentions two kinds still gets one plan.
interface ActionRule {
  words: string[];
  write: (name: string, capital: number, chain: string) => string;
}

const ACTION_RULES: ActionRule[] = [
  { words: ['lend', 'cdp', 'collateral'], write: (name, capital, chain) => `Supply $${capital} of USDC to ${name} on ${chain} and keep the position open.` },
  { words: ['dex', 'leveraged farm', 'liquidity manager'], write: (name, capital, chain) => `Provide $${capital} of liquidity to ${name}'s main pool on ${chain} and keep the position open.` },
  { words: ['bridge', 'cross chain'], write: (name, capital, chain) => `Bridge $${capital} of USDC to ${chain} through ${name}, then use the bridged funds inside its app.` },
  { words: ['stak', 'restak'], write: (name, capital, chain) => `Stake $${capital} of the chain's staking asset through ${name} and keep the receipt token.` },
  { words: ['perpetual', 'derivative', 'basis trad'], write: (name, capital, chain) => `Deposit $${capital} of USDC as margin on ${name} and open one small hedged position.` },
  { words: ['prediction'], write: (name, capital) => `Fund $${capital} and place one market position on ${name}.` },
  { words: ['curator', 'allocator', 'yield aggregator', 'onchain capital'], write: (name, capital, chain) => `Deposit $${capital} into a ${name} vault on ${chain} and keep the shares.` },
  { words: ['stable'], write: (name, capital, chain) => `Mint or deposit $${capital} of the stable asset through ${name} on ${chain}.` },
  { words: ['rwa'], write: (name, capital, chain) => `Mint $${capital} of the protocol's yield-bearing asset on ${chain} and hold it.` },
  { words: ['insurance'], write: (name, capital, chain) => `Buy $${capital} of cover from ${name} on ${chain} and keep the policy.` },
  { words: ['yield', 'farm', 'governance'], write: (name, capital, chain) => `Deposit $${capital} of USDC into ${name}'s main yield pool on ${chain} and keep the position open.` },
  { words: ['payment', 'card'], write: (name, capital, chain) => `Spend $${capital} through ${name} on ${chain} and keep the receipts.` },
  { words: ['otc'], write: (name, capital, chain) => `Place one $${capital} trade through ${name} and settle it on ${chain}.` },
];

/** The category's one action, in words a farmer can follow. */
function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  for (const rule of ACTION_RULES) {
    if (rule.words.some((w) => c.includes(w))) return rule.write(p.name, capital, chain);
  }
  return `Deposit $${capital} of USDC into ${p.name} on ${chain} and keep the position open.`;
}

/** A protocol's farm plan: seven steps, each an action with a cost and a time. */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const action = actionFor(p, capital, chain);
  const gas = capital >= 150 ? 8 : 4;
  return [
    {
      text: `Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.`,
      cost: 'under $3 of gas for the first transaction',
      time: '5 minutes',
    },
    {
      text: action,
      cost: `$${capital} of capital and about $${gas} of gas`,
      time: '15 minutes to set up',
    },
    {
      text: `Open the protocol's own points or rewards page and check what counts: deposits, volume, weeks active, or referrals.`,
      cost: 'nothing to check',
      time: '10 minutes',
    },
    {
      text: `Make one qualifying action each week, such as a deposit, a borrow, a swap or a vote, and never leave the wallet idle for a month.`,
      cost: 'about $2 of gas a week',
      time: '10 minutes a week',
    },
    {
      text: `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot.`,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
    },
    {
      text: `Never pay to claim anything: a real airdrop claim costs only gas, and any site asking for a fee or a seed phrase is a scam.`,
      cost: 'no fee to check, and never pay to claim',
      time: '5 minutes to verify the link',
    },
    {
      text: `Write the wallet, the dates and every transaction in a farm log so you can repeat the position or unwind it.`,
      cost: 'nothing but the log',
      time: '5 minutes',
    },
  ];
}
