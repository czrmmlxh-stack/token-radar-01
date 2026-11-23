// Token Radar's dashboard (model radar-2). Reads window.RADAR, written beside
// dashboard/ by main.ts, and renders the ranked board, a filterable table, a
// per-protocol detail drawer with the model's own inputs and the protocol's
// farm plan. No network: every byte it shows is in data.js.
//
// Deep links: #p=<slug> opens a protocol's detail, #q=<text> searches,
// #category=<name> and #chain=<name> filter, #tab=live shows live tokens.
// The three screenshots are taken through these links: the board, a detail
// view (#p=...) and a filtered view (#category=...).
(function () {
  'use strict';

  var DATA = window.RADAR;
  if (!DATA) return;
  var mount = document.getElementById('board');
  var view = { q: '', cat: 'all', chain: 'all', tab: 'pre-token', sortKey: 'implied', sortDir: -1, picked: null };

  var money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  function moneyOf(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return money.format(n);
  }
  function pctOf(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  }
  function ageOf(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return Math.max(0, Math.round(days)) + 'd';
  }

  // The model in one function: the page recomputes a row from the snapshot
  // figures and checks the number board.json carries, so the page's code and
  // the board's data are visibly the same arithmetic.
  function impliedOf(row, model) {
    var growth = Math.min(model.growth_cap, Math.max(model.growth_floor, row.change_7d === null || row.change_7d === undefined ? 0 : row.change_7d));
    var growthMult = 1 + (growth / 100) * model.growth_weight;
    var age = row.age_days === null || row.age_days === undefined ? model.unknown_age_days : row.age_days;
    var maturity = model.maturity_floor + (Math.min(Math.max(age, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
    var extra = Math.min(Math.max((row.chains || []).length - 1, 0), model.chain_max_bonus);
    var chainsMult = 1 + model.chain_step * extra;
    return Math.max(1, Math.round(row.tvl_usd * model.base_multiple * growthMult * maturity * chainsMult));
  }

  // Build one element: attrs map class/text/html/on*/anything to the matching
  // DOM call, and the rest of the arguments are children — strings become
  // text nodes, arrays are flattened one level, anything else is appended.
  function h(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k === 'html') node.innerHTML = attrs[k];
        else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), attrs[k]);
        else if (attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, attrs[k]);
      });
    }
    for (var i = 2; i < arguments.length; i++) {
      var child = arguments[i];
      if (child === null || child === undefined) continue;
      if (Array.isArray(child)) child.forEach(function (c) { if (c) node.appendChild(c); });
      else if (typeof child === 'string') node.appendChild(document.createTextNode(child));
      else node.appendChild(child);
    }
    return node;
  }

  // The farm plan is the same derivation main.ts writes to board.json:
  // category, chains, TVL and age decide the action, the capital, the hold
  // and every cost and time. No name is special-cased.
  function chainOf(p) { return p.chains && p.chains.length > 0 ? p.chains[0] : 'its main chain'; }
  function capitalFor(p) {
    if (p.tvl_usd >= 5e9) return 250;
    if (p.tvl_usd >= 1e9) return 150;
    if (p.tvl_usd >= 1e8) return 100;
    return 50;
  }
  function holdDaysFor(age) {
    if (age === null || age === undefined) return 30;
    if (age < 180) return 60;
    if (age < 365) return 45;
    return 30;
  }
  // One entry per kind of protocol: the words that pick it out of a
  // lower-cased category, in the order they are tried, and the action its
  // farmer takes. The order is the rule — the first entry whose words appear
  // wins — so a category that mentions two kinds still gets one plan.
  var ACTION_RULES = [
    { words: ['lend', 'cdp', 'collateral'], write: function (name, capital, chain) { return 'Supply $' + capital + ' of USDC to ' + name + ' on ' + chain + ' and keep the position open.'; } },
    { words: ['dex', 'leveraged farm', 'liquidity manager'], write: function (name, capital, chain) { return 'Provide $' + capital + ' of liquidity to ' + name + "'s main pool on " + chain + ' and keep the position open.'; } },
    { words: ['bridge', 'cross chain'], write: function (name, capital, chain) { return 'Bridge $' + capital + ' of USDC to ' + chain + ' through ' + name + ', then use the bridged funds inside its app.'; } },
    { words: ['stak', 'restak'], write: function (name, capital, chain) { return "Stake $" + capital + " of the chain's staking asset through " + name + ' and keep the receipt token.'; } },
    { words: ['perpetual', 'derivative', 'basis trad'], write: function (name, capital, chain) { return 'Deposit $' + capital + ' of USDC as margin on ' + name + ' and open one small hedged position.'; } },
    { words: ['prediction'], write: function (name, capital) { return 'Fund $' + capital + ' and place one market position on ' + name + '.'; } },
    { words: ['curator', 'allocator', 'yield aggregator', 'onchain capital'], write: function (name, capital, chain) { return 'Deposit $' + capital + ' into a ' + name + ' vault on ' + chain + ' and keep the shares.'; } },
    { words: ['stable'], write: function (name, capital, chain) { return 'Mint or deposit $' + capital + ' of the stable asset through ' + name + ' on ' + chain + '.'; } },
    { words: ['rwa'], write: function (name, capital, chain) { return "Mint $" + capital + " of the protocol's yield-bearing asset on " + chain + ' and hold it.'; } },
    { words: ['insurance'], write: function (name, capital, chain) { return 'Buy $' + capital + ' of cover from ' + name + ' on ' + chain + ' and keep the policy.'; } },
    { words: ['yield', 'farm', 'governance'], write: function (name, capital, chain) { return 'Deposit $' + capital + ' of USDC into ' + name + "'s main yield pool on " + chain + ' and keep the position open.'; } },
    { words: ['payment', 'card'], write: function (name, capital, chain) { return 'Spend $' + capital + ' through ' + name + ' on ' + chain + ' and keep the receipts.'; } },
    { words: ['otc'], write: function (name, capital, chain) { return 'Place one $' + capital + ' trade through ' + name + ' and settle it on ' + chain + '.'; } }
  ];
  function actionFor(p, capital, chain) {
    var c = (p.category || '').toLowerCase();
    for (var i = 0; i < ACTION_RULES.length; i++) {
      var rule = ACTION_RULES[i];
      if (rule.words.some(function (w) { return c.indexOf(w) >= 0; })) return rule.write(p.name, capital, chain);
    }
    return 'Deposit $' + capital + ' of USDC into ' + p.name + ' on ' + chain + ' and keep the position open.';
  }
  function stepText(step) {
    var s = step.text + ' Cost: ' + step.cost + '. Time: ' + step.time + '.';
    if (s.length > 600) s = s.slice(0, 596) + '...';
    if (s.length < 20) s = s + " Hold the position and check the protocol's own page.";
    return s;
  }
  function farmSteps(p) {
    var chain = chainOf(p);
    var capital = capitalFor(p);
    var hold = holdDaysFor(p.age_days);
    var gas = capital >= 150 ? 8 : 4;
    return [
      { text: 'Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.', cost: 'under $3 of gas for the first transaction', time: '5 minutes' },
      { text: actionFor(p, capital, chain), cost: '$' + capital + ' of capital and about $' + gas + ' of gas', time: '15 minutes to set up' },
      { text: "Open the protocol's own points or rewards page and check what counts: deposits, volume, weeks active, or referrals.", cost: 'nothing to check', time: '10 minutes' },
      { text: 'Make one qualifying action each week, such as a deposit, a borrow, a swap or a vote, and never leave the wallet idle for a month.', cost: 'about $2 of gas a week', time: '10 minutes a week' },
      { text: 'Hold the position for at least ' + hold + ' days so the activity is counted in more than one snapshot.', cost: 'the $' + capital + ' stays in the position', time: hold + ' days' },
      { text: 'Never pay to claim anything: a real airdrop claim costs only gas, and any site asking for a fee or a seed phrase is a scam.', cost: 'no fee to check, and never pay to claim', time: '5 minutes to verify the link' },
      { text: 'Write the wallet, the dates and every transaction in a farm log so you can repeat the position or unwind it.', cost: 'nothing but the log', time: '5 minutes' }
    ].map(stepText);
  }

  function readHash() {
    var hash = window.location.hash.replace(/^#/, '');
    if (!hash) return;
    var params = new URLSearchParams(hash);
    if (params.get('q')) view.q = params.get('q');
    if (params.get('p')) view.picked = params.get('p');
    if (params.get('category')) view.cat = params.get('category');
    if (params.get('chain')) view.chain = params.get('chain');
    if (params.get('tab')) view.tab = params.get('tab');
  }
  function writeHash() {
    var params = new URLSearchParams();
    if (view.q) params.set('q', view.q);
    if (view.cat !== 'all') params.set('category', view.cat);
    if (view.chain !== 'all') params.set('chain', view.chain);
    if (view.tab !== 'pre-token') params.set('tab', view.tab);
    if (view.picked) params.set('p', view.picked);
    var next = params.toString();
    if (next) window.history.replaceState(null, '', '#' + next);
    else window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }

  function filteredRows() {
    var q = view.q.trim().toLowerCase();
    return DATA.rows.filter(function (r) {
      if (view.cat !== 'all' && r.category !== view.cat) return false;
      if (view.chain !== 'all' && !(r.chains || []).includes(view.chain)) return false;
      if (!q) return true;
      var hay = [r.name, r.slug, r.category, (r.chains || []).join(' ')].join(' ').toLowerCase();
      return hay.indexOf(q) >= 0;
    });
  }
  function orderedRows(list) {
    var key = view.sortKey;
    return list.slice().sort(function (a, b) {
      var av, bv;
      if (key === 'name') { av = a.name.toLowerCase(); bv = b.name.toLowerCase(); }
      else if (key === 'tvl') { av = a.tvl_usd; bv = b.tvl_usd; }
      else if (key === 'growth') { av = a.change_7d === null ? -Infinity : a.change_7d; bv = b.change_7d === null ? -Infinity : b.change_7d; }
      else if (key === 'age') { av = a.age_days === null ? Infinity : a.age_days; bv = b.age_days === null ? Infinity : b.age_days; }
      else { av = a.implied_value_usd; bv = b.implied_value_usd; }
      if (av < bv) return -view.sortDir;
      if (av > bv) return view.sortDir;
      return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
    });
  }

  function masthead() {
    return h('header', { class: 'top' },
      h('div', { class: 'brand' }, h('span', { class: 'mark' }), h('span', { class: 'brand-name', text: 'Token Radar' })),
      h('div', { class: 'top-meta' },
        h('span', { text: 'Snapshot ' + DATA.as_of }),
        h('span', { text: 'DefiLlama protocol index' }),
        h('span', { text: DATA.model_version + ' model' })
      )
    );
  }

  function intro() {
    return h('section', { class: 'lede' },
      h('div', null,
        h('h1', { text: DATA.watchlist_size + ' watchlist protocols, ranked by implied value' }),
        h('p', null,
          'The watchlist is the floor: every protocol with at least ',
          h('b', { text: '$' + Math.round(DATA.floor_usd / 1e6) + 'M' }),
          ' of TVL and no token on record. The early radar adds ',
          h('b', { text: String(DATA.early_size) }),
          ' more pre-token protocols below that floor, so the board holds ',
          h('b', { text: String(DATA.board_size) }),
          ' rows in all. Implied value is a model, not a promise: a protocol can record no token and still have one.'
        )
      ),
      h('div', { class: 'facts' },
        h('div', { class: 'fact' }, h('span', { text: 'Watchlist covered' }), h('b', { text: DATA.watchlist_size + ' / ' + DATA.watchlist_size })),
        h('div', { class: 'fact' }, h('span', { text: 'Pre-token rows scored' }), h('b', { text: String(DATA.board_size) })),
        h('div', { class: 'fact' }, h('span', { text: 'Early rows below the floor' }), h('b', { text: String(DATA.early_size) })),
        h('div', { class: 'fact' }, h('span', { text: 'Live-token protocols set aside' }), h('b', { text: String(DATA.live_size) }))
      )
    );
  }

  function filterBar() {
    var categories = Array.from(new Set(DATA.rows.map(function (r) { return r.category || 'Other'; }))).sort();
    var chains = Array.from(new Set(DATA.rows.flatMap(function (r) { return r.chains || []; }))).sort();
    var search = h('input', { type: 'search', id: 'q', placeholder: 'Search name, category or chain', value: view.q, 'aria-label': 'Search the board' });
    search.addEventListener('input', function () { view.q = search.value; writeHash(); paint(); });
    var catSelect = h('select', { id: 'category', 'aria-label': 'Filter by category' },
      h('option', { value: 'all', text: 'All categories' }),
      categories.map(function (c) { return h('option', { value: c, text: c, selected: c === view.cat ? 'selected' : null }); })
    );
    catSelect.addEventListener('change', function () { view.cat = catSelect.value; writeHash(); paint(); });
    var chainSelect = h('select', { id: 'chain', 'aria-label': 'Filter by chain' },
      h('option', { value: 'all', text: 'All chains' }),
      chains.map(function (c) { return h('option', { value: c, text: c, selected: c === view.chain ? 'selected' : null }); })
    );
    chainSelect.addEventListener('change', function () { view.chain = chainSelect.value; writeHash(); paint(); });
    var pre = h('button', { type: 'button', 'aria-pressed': view.tab === 'pre-token' ? 'true' : 'false', text: 'Pre-token', onclick: function () { view.tab = 'pre-token'; paint(); } });
    var live = h('button', { type: 'button', 'aria-pressed': view.tab === 'live' ? 'true' : 'false', text: 'Live token', onclick: function () { view.tab = 'live'; paint(); } });
    return h('div', { class: 'controls' },
      h('div', { class: 'field' }, h('label', { for: 'q', text: 'Search' }), search),
      h('div', { class: 'field' }, h('label', { for: 'category', text: 'Category' }), catSelect),
      h('div', { class: 'field' }, h('label', { for: 'chain', text: 'Chain' }), chainSelect),
      h('div', { class: 'field' }, h('span', { class: 'sub', text: 'Token status' }), h('div', { class: 'tabs' }, pre, live)),
      h('span', { class: 'count', text: view.tab === 'pre-token' ? filteredRows().length + ' rows shown' : DATA.live.length + ' live-token protocols' })
    );
  }

  function sortCol(key, label) {
    return h('th', { scope: 'col' },
      h('button', { type: 'button', onclick: function () { if (view.sortKey === key) view.sortDir = -view.sortDir; else { view.sortKey = key; view.sortDir = -1; } paint(); } },
        label,
        view.sortKey === key ? h('span', { 'aria-hidden': 'true', text: view.sortDir < 0 ? ' v' : ' ^' }) : null
      )
    );
  }

  function boardView() {
    var list = orderedRows(filteredRows());
    if (list.length === 0) {
      return h('div', { class: 'panel' }, h('div', { class: 'empty' },
        h('h2', { text: 'No protocol matches that filter' }),
        h('p', { text: 'Clear the search or pick another category to see the board again.' }),
        h('button', { class: 'button primary', type: 'button', text: 'Clear filters', onclick: function () { view.q = ''; view.cat = 'all'; view.chain = 'all'; writeHash(); paint(); } })
      ));
    }
    var max = list[0].implied_value_usd || 1;
    var tbody = h('tbody');
    list.forEach(function (r) {
      var growth = r.change_7d === null ? 'n/a' : pctOf(r.change_7d);
      var growthClass = r.change_7d === null ? '' : r.change_7d >= 0 ? 'pos' : 'neg';
      var tr = h('tr', {
        'data-selected': view.picked === r.slug ? 'true' : 'false',
        'class': r.rank <= 3 ? 'top3' : null,
        tabindex: '0',
        onclick: function () { showProtocol(r.slug); },
        onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); showProtocol(r.slug); } }
      },
        h('td', { class: 'num', text: String(r.rank) }),
        h('td', null, h('div', { class: 'name' },
          h('b', { text: r.name }),
          h('span', { class: 'sub', text: (r.category || 'Other') + ' on ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') })
        )),
        h('td', { class: 'num', text: moneyOf(r.tvl_usd) }),
        h('td', { class: 'num ' + growthClass, text: growth }),
        h('td', { class: 'num', text: ageOf(r.age_days) }),
        h('td', null, h('div', { class: 'implied' },
          h('div', { class: 'bar', 'aria-hidden': 'true' }, h('i', { style: 'width:' + Math.max(3, Math.round((r.implied_value_usd / max) * 100)) + '%' })),
          h('span', { class: 'num', text: moneyOf(r.implied_value_usd) })
        )),
        h('td', null,
          r.watchlist ? h('span', { class: 'badge', text: 'watchlist' }) : h('span', { class: 'status', text: 'no token' })
        )
      );
      tbody.appendChild(tr);
    });
    return h('div', { class: 'panel' },
      h('div', { class: 'table-wrap' },
        h('table', null,
          h('caption', { class: 'sub', text: 'Pre-token protocols, strongest implied value first. Select a row for its model and farm plan.' }),
          h('thead', null, h('tr', null,
            sortCol('implied', 'Rank'),
            sortCol('name', 'Protocol'),
            sortCol('tvl', 'TVL'),
            sortCol('growth', '7d'),
            sortCol('age', 'Age'),
            sortCol('implied', 'Implied value'),
            h('th', { scope: 'col', text: 'Token' })
          )),
          tbody
        )
      )
    );
  }

  function liveView() {
    var tbody = h('tbody');
    DATA.live.forEach(function (r) {
      tbody.appendChild(h('tr', null,
        h('td', { class: 'num', text: 'live' }),
        h('td', null, h('div', { class: 'name' }, h('b', { text: r.name }), h('span', { class: 'sub', text: (r.category || 'Other') + ' on ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') }))),
        h('td', { class: 'num', text: moneyOf(r.tvl_usd) }),
        h('td', { class: 'num ' + (r.change_7d !== null && r.change_7d >= 0 ? 'pos' : 'neg'), text: pctOf(r.change_7d) }),
        h('td', { class: 'num', text: moneyOf(r.mcap_usd) }),
        h('td', null, h('span', { class: 'status live', text: 'already trades' }))
      ));
    });
    return h('div', { class: 'panel' },
      h('div', { class: 'table-wrap' },
        h('table', null,
          h('caption', { class: 'sub', text: 'Token live: these protocols already trade, so their market cap is a fact, not a model. They are set aside from the pre-token ranking.' }),
          h('thead', null, h('tr', null, h('th', { scope: 'col', text: 'Status' }), h('th', { scope: 'col', text: 'Protocol' }), h('th', { scope: 'col', text: 'TVL' }), h('th', { scope: 'col', text: '7d' }), h('th', { scope: 'col', text: 'Market cap' }), h('th', { scope: 'col', text: 'Token' }))),
          tbody
        )
      )
    );
  }

  function modelExplainer() {
    var m = DATA.model;
    return h('section', { class: 'panel model' },
      h('h2', { text: 'How implied value is computed' }),
      h('p', { class: 'sub', text: 'Every row is scored by one function of the snapshot figures. No protocol name is special-cased, and no row is hand-picked.' }),
      h('div', { class: 'formula' },
        'implied = round( tvl_usd x ', h('b', { text: String(m.base_multiple) }),
        ' x (1 + clamp(change_7d, ', h('b', { text: String(m.growth_floor) }), ', ', h('b', { text: String(m.growth_cap) }),
        ') / 100 x ', h('b', { text: String(m.growth_weight) }),
        ') x (', h('b', { text: String(m.maturity_floor) }), ' + min(age_days, ', h('b', { text: String(m.maturity_days) }),
        ') / ', h('b', { text: String(m.maturity_days) }), ' x ', h('b', { text: String(m.maturity_range) }),
        ') x (1 + ', h('b', { text: String(m.chain_step) }), ' x min(chains - 1, ', h('b', { text: String(m.chain_max_bonus) }), ')) )'
      ),
      h('p', { class: 'sub', text: 'TVL and seven-day growth come from the snapshot. Age is the time since the protocol was first listed, the best record of how long it has run with no token; an unlisted age uses ' + m.unknown_age_days + ' days. Chains counts the chains the snapshot lists for the protocol: wider distribution reaches more wallets. The early radar is every pre-token protocol the snapshot can rank, not just the top of the list, and the live-token protocols are set aside with their market caps shown.' })
    );
  }

  var dialog = h('dialog', { class: 'detail', id: 'detail', 'aria-labelledby': 'detail-title' });
  dialog.addEventListener('close', function () { view.picked = null; writeHash(); });

  function showProtocol(slug) {
    var row = DATA.rows.filter(function (r) { return r.slug === slug; })[0];
    if (!row) return;
    view.picked = slug;
    writeHash();
    dialog.textContent = '';
    var steps = farmSteps(row);
    var recomputed = impliedOf(row, DATA.model);
    dialog.appendChild(h('div', { class: 'detail-head' },
      h('div', null,
        h('span', { class: 'brand-name', text: 'Rank ' + row.rank + ' of ' + DATA.board_size + (row.watchlist ? ' · watchlist' : ' · early radar') }),
        h('h2', { id: 'detail-title', text: row.name }),
        h('p', { class: 'sub', text: (row.category || 'Other') + ' on ' + (row.chains && row.chains.length ? row.chains.join(', ') : 'an unnamed chain') })
      ),
      h('button', { class: 'close', type: 'button', 'aria-label': 'Close details', text: 'Close', onclick: function () { dialog.close(); } })
    ));
    dialog.appendChild(h('section', { class: 'detail-section' },
      h('h3', { text: 'Implied value' }),
      h('div', { class: 'equation' },
        h('div', null, h('span', { text: 'TVL' }), h('b', { class: 'num', text: moneyOf(row.tvl_usd) })),
        h('div', null, h('span', { text: 'Seven-day growth' }), h('b', { class: 'num', text: pctOf(row.change_7d) })),
        h('div', null, h('span', { text: 'Age with no token' }), h('b', { class: 'num', text: ageOf(row.age_days) })),
        h('div', null, h('span', { text: 'Chains' }), h('b', { class: 'num', text: String((row.chains || []).length) })),
        h('div', null, h('span', { text: 'Growth multiplier' }), h('b', { class: 'num', text: String(row.growth_multiplier) })),
        h('div', null, h('span', { text: 'Maturity multiplier' }), h('b', { class: 'num', text: String(row.maturity_multiplier) })),
        h('div', null, h('span', { text: 'Chains multiplier' }), h('b', { class: 'num', text: String(row.chains_multiplier) })),
        h('div', { class: 'total' }, h('span', { text: 'Implied value' }), h('b', { class: 'num', text: moneyOf(row.implied_value_usd) }))
      ),
      h('p', { class: 'sub', text: 'Model ' + DATA.model_version + ': the same function scores every protocol. The page recomputes this row as ' + moneyOf(recomputed) + (recomputed === row.implied_value_usd ? ', the same number board.json carries.' : ', which differs from the board: the data would be stale.') + ' This is an estimate, not a price, and no token is promised.' })
    ));
    dialog.appendChild(h('section', { class: 'detail-section' },
      h('h3', { text: 'Farm plan' }),
      h('ol', { class: 'steps' }, steps.map(function (s) {
        var at = s.indexOf(' Cost: ');
        var action = at >= 0 ? s.slice(0, at) : s;
        var tail = at >= 0 ? s.slice(at + 1) : '';
        return h('li', null, h('b', { text: action }), h('span', { class: 'cost', text: tail }));
      })),
      h('p', { class: 'warn', text: 'The snapshot records no token for this protocol; that is DefiLlama\u2019s record, not proof it has none. Farm only what you can afford to leave in the position.' })
    ));
    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
  }

  function pageFoot() {
    return h('footer', { class: 'foot' },
      h('span', { text: 'Source: ' + DATA.source + '. Snapshot date ' + DATA.as_of + '. Model ' + DATA.model_version + '.' }),
      h('span', { text: 'Implied value is this dashboard\u2019s own claim from the snapshot\u2019s figures; it is not a price and no token launch is predicted.' })
    );
  }

  function paint() {
    mount.textContent = '';
    var shell = h('div', { class: 'shell' });
    shell.appendChild(masthead());
    shell.appendChild(intro());
    shell.appendChild(filterBar());
    shell.appendChild(view.tab === 'pre-token' ? boardView() : liveView());
    if (view.tab === 'pre-token') shell.appendChild(modelExplainer());
    shell.appendChild(pageFoot());
    mount.appendChild(shell);
    mount.setAttribute('aria-busy', 'false');
    if (!dialog.isConnected) mount.appendChild(dialog);
    if (view.picked) showProtocol(view.picked);
  }

  readHash();
  paint();
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && dialog.open) dialog.close();
  });
})();
