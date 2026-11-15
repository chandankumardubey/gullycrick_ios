/* Gully Scorer – Team Maker: weighted, randomised balanced split + form-based auto ratings */
'use strict';
const TeamMaker = (() => {
  const { DB, ui, esc, nm, short, save, career, playerByName, V, S, A } = GS;
  const SK = ['bat', 'bowl', 'field'];
  const SKL = { bat: 'Batting', bowl: 'Bowling', field: 'Fielding' };
  const PRESETS = {
    Balanced: { bat: 34, bowl: 33, field: 33 },
    'Batting heavy': { bat: 60, bowl: 25, field: 15 },
    'Bowling heavy': { bat: 25, bowl: 60, field: 15 },
    'Bat + Bowl only': { bat: 50, bowl: 50, field: 0 },
  };
  const T = () => {
    const t = DB.tm || (DB.tm = {});
    return Object.assign(t, Object.assign({ avail: [], A: [], B: [], nameA: 'Team A', nameB: 'Team B', locks: {}, common: null, sel: [], w: { bat: 40, bowl: 40, field: 20 }, blend: 30, rand: 30, skills: true, commonOn: false, last: null, autoRate: true, formN: 8 }, t));
  };
  const rating = id => (DB.players[id].rt || (DB.players[id].rt = { bat: 3, bowl: 3, field: 3 }));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const half = v => Math.round(v * 2) / 2;

  function toScale(raw) {
    const out = {};
    SK.forEach(k => {
      const e = Object.entries(raw[k]).sort((a, b) => a[1] - b[1]); const n = e.length;
      e.forEach(([id, v], i) => {
        let j = i; while (j + 1 < n && e[j + 1][1] === v) j++;
        const rank = n > 1 ? ((i + j) / 2) / (n - 1) : 0.5;
        (out[id] || (out[id] = {}))[k] = 1 + 4 * rank;
      });
    });
    return out;
  }
  function statRatings() {
    const P = career(), raw = { bat: {}, bowl: {}, field: {} };
    Object.values(P).forEach(p => {
      if (p.inn) raw.bat[p.id] = (p.r / p.inn) * Math.sqrt(clamp(p.b ? p.r / p.b : 1, 0.4, 2.5));
      if (p.bb >= 6) raw.bowl[p.id] = (p.w * 6 / p.bb) * 10 + Math.max(0, 12 - p.br * 6 / p.bb);
      if (p.m.size) raw.field[p.id] = (p.ct + p.ro + p.st) / p.m.size;
    });
    return toScale(raw);
  }
  function formRatings(N = T().formN, decay = 0.8) {
    const P = career(), raw = { bat: {}, bowl: {}, field: {} }, info = {};
    Object.values(P).forEach(p => {
      const L = p.perMatch.slice(-N).reverse(); if (!L.length) return;
      let wr = 0, wb = 0, wi = 0, ww = 0, wwr = 0, wwb = 0, wf = 0, wt = 0;
      L.forEach((x, k) => {
        const w = Math.pow(decay, k); wt += w;
        if (x.r != null) { wr += w * x.r; wb += w * x.b; wi += w; }
        if (x.w != null) { ww += w * x.w; wwr += w * x.wr; wwb += w * x.wb; }
        wf += w * (x.ct + x.ro);
      });
      if (wi) raw.bat[p.id] = (wr / wi) * Math.sqrt(clamp(wb ? wr / wb : 1, 0.4, 2.5));
      if (wwb >= 6 * 0.8) raw.bowl[p.id] = (ww * 6 / wwb) * 10 + Math.max(0, 12 - wwr * 6 / wwb);
      raw.field[p.id] = wf / wt;
      info[p.id] = L.length;
    });
    const sc = toScale(raw);
    Object.keys(sc).forEach(id => sc[id].n = info[id]);
    return sc;
  }
  function suggestions() {
    const F = formRatings();
    return Object.keys(DB.players).filter(id => F[id]).map(id => {
      const cur = rating(id), sug = {};
      SK.forEach(k => sug[k] = F[id][k] == null ? cur[k] : half(F[id][k]));
      return { id, cur: { ...cur }, sug, n: F[id].n, changed: SK.some(k => Math.abs(sug[k] - cur[k]) >= 0.5) };
    }).sort((a, b) => b.changed - a.changed || nm(a.id).localeCompare(nm(b.id)));
  }
  function autoUpdate(m) {
    const t = T(); if (!t.autoRate || !m.career) return 0;
    const F = formRatings(); let n = 0;
    m.teams.flatMap(x => x.players).forEach(id => {
      if (!F[id] || !DB.players[id]) return;
      const r = rating(id);
      SK.forEach(k => { if (F[id][k] != null) { const nv = half(0.7 * r[k] + 0.3 * F[id][k]); if (nv !== r[k]) { r[k] = nv; n++; } } });
    });
    return n;
  }

  function profile() {
    const t = T(), sr = t.blend > 0 ? statRatings() : {}, b = t.blend / 100;
    const sumW = SK.reduce((a, k) => a + (+t.w[k] || 0), 0) || 1;
    const eff = {}, str = {};
    Object.keys(DB.players).forEach(id => {
      const r = rating(id), e = {};
      SK.forEach(k => { const s = sr[id]?.[k]; e[k] = s == null ? r[k] : (1 - b) * r[k] + b * s; });
      eff[id] = e;
      str[id] = SK.reduce((a, k) => a + e[k] * (+t.w[k] || 0), 0) / sumW;
    });
    return { eff, str, sumW };
  }
  function cost(Aids, Bids, P, t) {
    const sum = (ids, f) => ids.reduce((a, id) => a + f(id), 0);
    let c = Math.abs(sum(Aids, id => P.str[id]) - sum(Bids, id => P.str[id]));
    if (t.skills) SK.forEach(k => { if (+t.w[k]) c += 0.35 * (+t.w[k] / P.sumW) * Math.abs(sum(Aids, id => P.eff[id][k]) - sum(Bids, id => P.eff[id][k])); });
    return c;
  }
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  function solve(fixedA, fixedB, free) {
    const t = T(), P = profile();
    fixedA = [...fixedA]; fixedB = [...fixedB]; free = [...free];
    let common = null;
    const N0 = fixedA.length + fixedB.length + free.length;
    if (t.commonOn && N0 % 2 === 1 && free.length) {
      const sorted = [...free].sort((a, b) => P.str[a] - P.str[b]);
      common = sorted[Math.floor(sorted.length / 2)];
      free = free.filter(id => id !== common);
    }
    const N = fixedA.length + fixedB.length + free.length;
    const G = (DB.links || []).map(g => ({ mode: g.mode, ids: g.ids.filter(id => DB.players[id] && (fixedA.includes(id) || fixedB.includes(id) || free.includes(id))) })).filter(g => g.ids.length >= 2);
    const viol = (a, b) => {
      if (!G.length) return 0;
      const sa = new Set(a), sb = new Set(b); let v = 0;
      G.forEach(g => { let na = 0, nb = 0; g.ids.forEach(id => { if (sa.has(id)) na++; else if (sb.has(id)) nb++; }); v += g.mode === 'together' ? Math.min(na, nb) : Math.max(0, Math.abs(na - nb) - 1); });
      return v;
    };
    const costP = (a, b) => cost(a, b, P, t) + 1000 * viol(a, b);
    const sizes = [...new Set([Math.floor(N / 2), Math.ceil(N / 2)])].map(s => Math.max(fixedA.length, Math.min(N - fixedB.length, s)));
    const sols = new Map();
    const trials = Math.min(900, 60 + free.length * 40 + G.length * 80);
    for (let tr = 0; tr < trials; tr++) {
      const sizeA = sizes[tr % sizes.length];
      const f = shuffle([...free]);
      let a = f.slice(0, sizeA - fixedA.length), b = f.slice(sizeA - fixedA.length);
      let c = costP(fixedA.concat(a), fixedB.concat(b)), improved = true;
      while (improved) {
        improved = false;
        for (let i = 0; i < a.length && !improved; i++) for (let j = 0; j < b.length && !improved; j++) {
          const a2 = a.slice(), b2 = b.slice(); [a2[i], b2[j]] = [b[j], a[i]];
          const c2 = costP(fixedA.concat(a2), fixedB.concat(b2));
          if (c2 < c - 1e-9) { a = a2; b = b2; c = c2; improved = true; }
        }
      }
      const key = [...a].sort().join(',');
      if (!sols.has(key)) sols.set(key, { a, b, c, v: viol(fixedA.concat(a), fixedB.concat(b)) });
    }
    const list = [...sols.values()].sort((x, y) => x.c - y.c);
    const avg = Object.values(P.str).reduce((s, v) => s + v, 0) / Math.max(1, Object.keys(P.str).length);
    const tol = list.length ? list[0].c + (t.rand / 100) * avg * 0.6 + 1e-9 : 0;
    const pool = list.filter(x => x.c <= tol);
    const pk = pool[Math.floor(Math.random() * pool.length)] || { a: [], b: [], c: 0, v: 0 };
    const res = { A: fixedA.concat(pk.a), B: fixedB.concat(pk.b), common, cost: pk.c, options: pool.length, viol: pk.v || 0 };
    if (common) { res.A.push(common); res.B.push(common); }
    return res;
  }
  function teamStats(ids, P) {
    const s = { str: 0, bat: 0, bowl: 0, field: 0 };
    ids.forEach(id => { s.str += P.str[id]; SK.forEach(k => s[k] += P.eff[id][k]); });
    return s;
  }

  const participants = () => T().avail.filter(id => DB.players[id] && !DB.players[id].del && !DB.players[id].tmp);
  function unassigned() { const t = T(); return participants().filter(id => !t.A.includes(id) && !t.B.includes(id)); }
  function apply(res, msg) {
    const t = T(); t.A = res.A; t.B = res.B; t.common = res.common; t.sel = [];
    t.last = { cost: res.cost, options: res.options }; save();
    if (res.viol) msg = (msg || 'Teams updated') + ' – ⚠ some linked players could not be placed as marked (locks / fixed players)';
    if (msg) GS.toast(msg); else GS.render();
  }
  function makeAll() {
    const t = T(), ps = participants();
    if (ps.length < 2) return GS.toast('Select at least 2 players in the pool');
    const fa = ps.filter(id => t.locks[id] === 'A'), fb = ps.filter(id => t.locks[id] === 'B');
    apply(solve(fa, fb, ps.filter(id => !t.locks[id])), 'Teams made');
  }
  function reshuffle(onlySelected) {
    const t = T();
    const strip = ids => ids.filter(id => id !== t.common);
    const A0 = strip(t.A).filter(id => participants().includes(id)), B0 = strip(t.B).filter(id => participants().includes(id));
    const sel = new Set(t.sel);
    if (t.common && !onlySelected) sel.add(t.common);
    const commonFree = t.common && sel.has(t.common);
    const isFree = id => !t.locks[id] && (!onlySelected || sel.has(id));
    const free = A0.filter(isFree).concat(B0.filter(isFree), unassigned());
    if (commonFree) free.push(t.common);
    if (onlySelected && free.length < 2) return GS.toast('Tick at least 2 players (or new pool players) to reshuffle');
    const kept = A0.concat(B0).filter(id => !isFree(id));
    const fa = kept.filter(id => t.locks[id] === 'A' || (!t.locks[id] && A0.includes(id)));
    const fb = kept.filter(id => t.locks[id] === 'B' || (!t.locks[id] && B0.includes(id)));
    if (t.common && !commonFree) { fa.push(t.common); fb.push(t.common); }
    const prev = t.commonOn; if (t.common && !commonFree) t.commonOn = false;
    const res = solve(fa, fb, free);
    t.commonOn = prev;
    if (t.common && !commonFree) res.common = t.common;
    apply(res, onlySelected ? `Reshuffled ${free.length} player${free.length > 1 ? 's' : ''}` : 'All players reshuffled');
  }
  function fitNew() {
    const t = T(), u = unassigned(); if (!u.length) return GS.toast('No new players to fit in');
    const ps = participants();
    const fa = t.A.filter(id => ps.includes(id)), fb = t.B.filter(id => ps.includes(id));
    const prev = t.commonOn; if (t.common) t.commonOn = false;
    const res = solve(fa, fb, u); t.commonOn = prev; if (t.common) res.common = t.common;
    apply(res, `Added ${u.length} player${u.length > 1 ? 's' : ''}`);
  }

  // ---- pool removal + linked players ----
  const gl = () => (DB.links || (DB.links = []));
  const tagsFor = id => gl().map((g, k) => g.ids.includes(id) ? `<span class="pill ${g.mode === 'together' ? 'green' : 'red'}" title="${g.mode === 'together' ? 'Keep together' : 'Keep apart'}">🔗G${k + 1}</span>` : '').join('');
  const isUsed = id => DB.matches.some(m => m.teams.some(t => t.players.includes(id))) || DB.tours.some(t => t.teams.some(x => x.players.includes(id))) || DB.polls.some(p => (p.players || []).includes(id));
  function removePlayers(ids) {
    const t = T(), S = new Set(ids);
    ids.forEach(id => { if (DB.players[id]) DB.players[id].del = true; delete t.locks[id]; });
    t.avail = t.avail.filter(x => !S.has(x)); t.A = t.A.filter(x => !S.has(x)); t.B = t.B.filter(x => !S.has(x)); t.sel = t.sel.filter(x => !S.has(x));
    if (S.has(t.common)) t.common = null;
    gl().forEach(g => { g.ids = g.ids.filter(x => !S.has(x)); }); DB.links = gl().filter(g => g.ids.length >= 2);
    if (S.has(DB.settings.me)) DB.settings.me = '';
    ui.tmPick = (ui.tmPick || []).filter(x => !S.has(x));
  }
  const confirmRemove = ids => confirm(`Remove ${ids.length === 1 ? nm(ids[0]) : ids.length + ' players'} from the player pool?\n\nTheir past matches and stats are kept, and you can restore them from “Removed players”.`);
  const rateOpts = v => [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5].map(n => `<option value="${n}" ${half(v) === n ? 'selected' : ''}>${n}</option>`).join('');
  V.teams = () => {
    const t = T(), P = profile(), ps = new Set(participants());
    const manage = !!ui.tmManage, picks = new Set(ui.tmPick || []);
    const all = GS.pool().sort((a, b) => a.name.localeCompare(b.name));
    const slider = (key, label, val, sub) => `<div class="sl"><label>${label} <output>${val}${sub || ''}</output></label><input type="range" min="0" max="100" step="5" value="${val}" data-chg="tmSet" data-k="${key}" aria-label="${label}"></div>`;
    const rsel = (id, k) => `<label class="mini">${k === 'bat' ? 'Bat' : k === 'bowl' ? 'Bowl' : 'Fld'}<select data-chg="tmRate" data-id="${id}" data-k="${k}">${rateOpts(rating(id)[k])}</select></label>`;
    const poolRows = all.map(p => `<div class="prow ${ps.has(p.id) ? 'on' : ''}">
        <label class="chk grow"><input type="checkbox" data-chg="tmAvail" data-id="${p.id}" ${ps.has(p.id) ? 'checked' : ''}> <b>${esc(p.name)}</b> <span class="pill">${P.str[p.id].toFixed(1)}</span>${tagsFor(p.id)}</label>
        <select class="lock" data-chg="tmLock" data-id="${p.id}" aria-label="Lock to team"><option value="">Any team</option><option value="A" ${t.locks[p.id] === 'A' ? 'selected' : ''}>🔒 ${esc(t.nameA)}</option><option value="B" ${t.locks[p.id] === 'B' ? 'selected' : ''}>🔒 ${esc(t.nameB)}</option></select>
        <div class="rates">${manage ? `<label class="mini pick"><input type="checkbox" data-chg="tmPick" data-id="${p.id}" ${picks.has(p.id) ? 'checked' : ''}> select</label>` : ''}${SK.map(k => rsel(p.id, k)).join('')}<button type="button" class="btn sm danger" data-act="tmDel" data-id="${p.id}" aria-label="Remove ${esc(p.name)} from pool">🗑</button></div></div>`).join('');
    const teamOpts = DB.teams.map((x, i) => `<option value="${i}">${esc(x.name)} (${x.players.length})</option>`).join('');
    const polls = DB.polls.filter(p => Object.values(p.resp || {}).includes('in'));

    let result = '';
    if (t.A.length || t.B.length) {
      const sa = teamStats(t.A, P), sb = teamStats(t.B, P), conf = GS.linkConflicts(t.A, t.B);
      const bal = Math.max(sa.str, sb.str) ? Math.round(100 * Math.min(sa.str, sb.str) / Math.max(sa.str, sb.str)) : 100;
      const bar = k => { const a = sa[k], b = sb[k], tot = a + b || 1; return `<div class="cmp"><span>${SKL[k] || 'Overall'}</span><div class="cbar"><i style="width:${(100 * a / tot).toFixed(1)}%"></i></div><small>${a.toFixed(1)} : ${b.toFixed(1)}</small></div>`; };
      const block = (K, ids, s) => `<div class="team">
        <input class="tname" value="${esc(t['name' + K])}" data-chg="tmName" data-k="${K}" maxlength="24" aria-label="Team name">
        <div class="muted small">${ids.length} players · strength ${s.str.toFixed(1)}</div>
        ${ids.map(id => `<div class="tp ${t.sel.includes(id) ? 'sel' : ''}">
          <label class="chk grow"><input type="checkbox" data-chg="tmSel" data-id="${id}" ${t.sel.includes(id) ? 'checked' : ''}> ${esc(short(id))}${id === t.common ? ' <span class="pill yellow">common</span>' : ''}${t.locks[id] ? ' 🔒' : ''}</label>
          <span class="muted small">${P.str[id].toFixed(1)}</span>
          ${id === t.common ? '' : `<button type="button" class="btn sm" data-act="tmMove" data-id="${id}" aria-label="Move to other team">⇄</button>`}
          <button type="button" class="btn sm" data-act="tmDrop" data-id="${id}" aria-label="Remove">✕</button></div>`).join('')}</div>`;
      const un = unassigned();
      result = `<div class="card" id="tmResult"><div class="row between"><h4>Teams</h4><span class="pill ${bal >= 95 ? 'green' : bal >= 85 ? 'yellow' : 'red'}">${bal}% balanced</span></div>
        <div class="cmpwrap">${bar('str')}${SK.filter(k => +t.w[k]).map(bar).join('')}</div>
        <div class="teams2">${block('A', t.A, sa)}${block('B', t.B, sb)}</div>
        ${conf.length ? `<div class="card tight warn"><b>⚠ Link conflict${conf.length > 1 ? 's' : ''}:</b> <span class="small">${conf.map(esc).join(' · ')}</span><span class="muted tiny">Reshuffle to fix – or start anyway; it is recorded as an override in the match audit.</span></div>` : ''}
        ${un.length ? `<div class="card tight warn"><b>New in pool, not in a team:</b> ${un.map(id => esc(nm(id))).join(', ')}<button type="button" class="btn sm primary" data-act="tmFit">Fit them in</button></div>` : ''}
        <div class="grid2"><button type="button" class="btn" data-act="tmReSel" ${t.sel.length || un.length ? '' : 'disabled'}>🎲 Reshuffle selected (${t.sel.length + un.length})</button>
        <button type="button" class="btn" data-act="tmReAll">🔀 Reshuffle all</button></div>
        <div class="grid2"><button type="button" class="btn" data-act="tmSave">💾 Save teams</button><button type="button" class="btn primary" data-act="tmUse">Start match ▶</button></div>
        <p class="muted tiny">Tick players in either team and tap “Reshuffle selected” to redistribute only them – everyone else stays put. Locked players never move.</p></div>`;
    }

    return `${GS.header('Team maker')}<main>
      ${result}
      <details id="dW" class="card" ${t.A.length ? '' : 'open'}><summary>⚖️ Weightage</summary>
        <div class="chips">${Object.keys(PRESETS).map(k => `<button type="button" class="tog" data-act="tmPreset" data-k="${k}">${k}</button>`).join('')}</div>
        ${SK.map(k => slider('w.' + k, SKL[k] + ' weight', t.w[k])).join('')}
        ${slider('blend', 'Use career stats', t.blend, '%')}
        <p class="muted tiny">0% = only your 1–5 ratings, 100% = only stats from scored matches (players without stats keep their ratings).</p>
        ${slider('rand', 'Randomness', t.rand, '%')}
        <p class="muted tiny">0% = always the most balanced split; higher = more variety among near-balanced splits.</p>
        <label class="chk"><input type="checkbox" data-chg="tmFlag" data-k="skills" ${t.skills ? 'checked' : ''}> Balance each skill separately (not just the total)</label>
        <label class="chk"><input type="checkbox" data-chg="tmFlag" data-k="commonOn" ${t.commonOn ? 'checked' : ''}> Odd number of players → one common player plays for both</label>
      </details>
      <details id="dAuto" class="card"><summary>📈 Auto ratings from form</summary>
        <p class="small">Ratings can follow each player's recent form (last ${t.formN} matches, newer ones count more).</p>
        <label class="chk"><input type="checkbox" data-chg="tmFlag" data-k="autoRate" ${t.autoRate ? 'checked' : ''}> After every match, nudge ratings of everyone who played towards their form</label>
        <button type="button" class="btn block" data-act="tmSuggest">Review suggested ratings</button></details>
      ${DB.teams.length >= 1 ? `<details id="dRe" class="card"><summary>🔁 Redistribute between saved teams</summary>
        <div class="grid2"><select id="tmLA" aria-label="First team"><option value="">Team…</option>${teamOpts}</select><select id="tmLB" aria-label="Second team"><option value="">Team…</option>${teamOpts}</select></div>
        <div class="grid2"><button type="button" class="btn" data-act="tmLoad" data-k="keep">Load as-is</button><button type="button" class="btn primary" data-act="tmLoad" data-k="mix">Load & rebalance</button></div>
        <p class="muted tiny">“Load as-is” keeps the current sides so you can tick a few players and reshuffle only them.</p></details>` : ''}
      <details id="dLinks" class="card" ${gl().length ? 'open' : ''}><summary>🔗 Linked players (${gl().length})</summary>
        <p class="muted small">Tag 2 or more players so team making respects it: <b>Keep apart</b> spreads them across both teams (a pair is always split), <b>Keep together</b> puts them on the same side. Use “Select players” in the pool below to create a link. You can still override by hand – it is flagged and recorded in the match audit.</p>
        ${gl().map((g, k) => `<div class="lkrow"><div class="row between"><b>G${k + 1} · ${g.mode === 'together' ? 'Keep together' : 'Keep apart'}</b><span><button type="button" class="btn sm" data-act="tmLinkMode" data-i="${k}">⇄ ${g.mode === 'together' ? 'Make keep-apart' : 'Make keep-together'}</button> <button type="button" class="btn sm danger" data-act="tmLinkDel" data-i="${k}" aria-label="Delete link group">✕</button></span></div>
          <div class="chips">${g.ids.map(id => `<span class="chipchk">${esc(nm(id))} <button type="button" class="btn sm" data-act="tmLinkRm" data-i="${k}" data-id="${id}" aria-label="Remove ${esc(nm(id))} from group">✕</button></span>`).join('')}</div></div>`).join('') || '<p class="muted small">No links yet.</p>'}
      </details>
      <div class="card"><div class="row between"><h4>Player pool <span class="muted small">(${ps.size} playing)</span></h4>
        <span><button type="button" class="btn sm" data-act="tmAll" data-k="1">All</button> <button type="button" class="btn sm" data-act="tmAll" data-k="0">None</button></span></div>
        <div class="row gap wrap mt"><button type="button" class="btn sm ${manage ? 'primary' : ''}" data-act="tmManage">${manage ? '✔ Done selecting' : '☑ Select players (delete / link)'}</button></div>
        ${manage ? `<div class="card tight warn"><span class="small"><b>${picks.size}</b> selected</span>
          <button type="button" class="btn sm" data-act="tmPickSet" data-k="all">All</button><button type="button" class="btn sm" data-act="tmPickSet" data-k="none">None</button><button type="button" class="btn sm" data-act="tmPickSet" data-k="idle">Not playing</button>
          <button type="button" class="btn sm danger" data-act="tmDelPick" ${picks.size ? '' : 'disabled'}>🗑 Delete selected</button>
          <button type="button" class="btn sm" data-act="tmLink" data-k="apart" ${picks.size > 1 ? '' : 'disabled'}>🔗 Keep apart</button>
          <button type="button" class="btn sm" data-act="tmLink" data-k="together" ${picks.size > 1 ? '' : 'disabled'}>🔗 Keep together</button></div>` : ''}
        ${polls.length ? `<div class="row gap mt"><select id="tmPoll" aria-label="Poll"><option value="">Pick “In” players from a poll…</option>${polls.map(p => `<option value="${p.id}">${esc(p.title)} (${Object.values(p.resp).filter(x => x === 'in').length} in)</option>`).join('')}</select><button type="button" class="btn" data-act="tmFromPoll">Use</button></div>` : ''}
        <div class="row gap mt"><input id="tmNew" placeholder="Add players (comma separated)" aria-label="New players"><button type="button" class="btn" data-act="tmAdd">Add</button></div>
        <div class="pool">${poolRows || '<p class="muted small">No players yet – add some above.</p>'}</div></div>
      ${(() => { const rm = Object.values(DB.players).filter(p => p.del && !p.tmp); return rm.length ? `<details id="dRm" class="card"><summary>🗑 Removed players (${rm.length})</summary>${rm.map(p => `<div class="row between"><span>${esc(p.name)}</span><span><button type="button" class="btn sm" data-act="tmRestore" data-id="${p.id}">↺ Restore</button> <button type="button" class="btn sm danger" data-act="tmErase" data-id="${p.id}" ${isUsed(p.id) ? 'disabled title="Has match history"' : ''}>Erase</button></span></div>`).join('')}<p class="muted tiny">Erase is only possible for players with no match history.</p></details>` : ''; })()}
      <button type="button" class="btn primary block xl" data-act="tmMake">🎲 Make balanced teams</button>
    </main>`;
  };

  S.rateSuggest = () => {
    const L = suggestions();
    if (!L.length) return `<h3>Suggested ratings</h3><p class="small">No scored career matches yet. Finish a match (with “Count in career stats” on) and suggestions will appear.</p><button type="button" class="btn block" data-act="closeSheet">Close</button>`;
    const cell = (a, b) => a === b ? `${a}` : `${a}→<b class="${b > a ? 'up' : 'down'}">${b}</b>`;
    return `<h3>Suggested ratings from form</h3>
      <table class="t full"><tr><th></th><th>Player</th><th>Bat</th><th>Bowl</th><th>Fld</th><th>M</th></tr>
      ${L.map(x => `<tr><td><input type="checkbox" class="rsChk" value="${x.id}" ${x.changed ? 'checked' : ''} aria-label="Apply for ${esc(nm(x.id))}"></td><td>${esc(short(x.id))}</td>${SK.map(k => `<td>${cell(x.cur[k], x.sug[k])}</td>`).join('')}<td>${x.n}</td></tr>`).join('')}</table>
      <p class="muted tiny">1–5 scale, ranked against everyone with stats. M = matches used.</p>
      <div class="row gap"><button type="button" class="btn" data-act="closeSheet">Cancel</button><button type="button" class="btn primary grow" data-act="tmApplySug">Apply ticked</button></div>`;
  };

  Object.assign(A, {
    tmManage: () => { ui.tmManage = !ui.tmManage; ui.tmPick = []; GS.render(); },
    tmPick: (d, el) => { ui.tmPick = el.checked ? [...new Set([...(ui.tmPick || []), d.id])] : (ui.tmPick || []).filter(x => x !== d.id); GS.render(); },
    tmPickSet: d => { const ps = GS.pool(), play = new Set(participants()); ui.tmPick = d.k === 'all' ? ps.map(p => p.id) : d.k === 'none' ? [] : ps.filter(p => !play.has(p.id)).map(p => p.id); GS.render(); },
    tmDel: d => { if (!confirmRemove([d.id])) return; removePlayers([d.id]); save(); GS.toast('Removed from pool'); },
    tmDelPick: () => { const ids = (ui.tmPick || []).slice(); if (!ids.length) return GS.toast('Select players first'); if (!confirmRemove(ids)) return; removePlayers(ids); save(); GS.toast(`${ids.length} player${ids.length > 1 ? 's' : ''} removed`); },
    tmRestore: d => { delete DB.players[d.id].del; save(); GS.toast(`${nm(d.id)} restored`); },
    tmErase: d => { if (isUsed(d.id)) return GS.toast('This player has match history'); if (!confirm(`Permanently erase ${nm(d.id)}?`)) return; DB.teams.forEach(x => { x.players = x.players.filter(p => p !== d.id); }); delete DB.players[d.id]; save(); GS.render(); },
    tmLink: d => {
      const ids = (ui.tmPick || []).filter(id => DB.players[id]); if (ids.length < 2) return GS.toast('Tick 2 or more players first');
      const key = [...ids].sort().join(',');
      if (gl().some(g => g.mode === d.k && [...g.ids].sort().join(',') === key)) return GS.toast('That link already exists');
      gl().push({ id: GS.uid(), mode: d.k, ids }); ui.tmPick = []; ui.tmManage = false; save(); GS.toast(`Linked ${ids.length} players – ${d.k === 'together' ? 'keep together' : 'keep apart'}`);
    },
    tmLinkMode: d => { const g = gl()[+d.i]; if (g) { g.mode = g.mode === 'together' ? 'apart' : 'together'; save(); GS.render(); } },
    tmLinkDel: d => { gl().splice(+d.i, 1); save(); GS.render(); },
    tmLinkRm: d => { const g = gl()[+d.i]; if (!g) return; g.ids = g.ids.filter(x => x !== d.id); if (g.ids.length < 2) gl().splice(+d.i, 1); save(); GS.render(); },
    tmMake: makeAll,
    tmReSel: () => reshuffle(true),
    tmReAll: () => reshuffle(false),
    tmFit: fitNew,
    tmSuggest: () => { ui.sheet = { type: 'rateSuggest' }; GS.render(); },
    tmApplySug: () => {
      const ids = new Set([...document.querySelectorAll('.rsChk:checked')].map(x => x.value));
      let n = 0; suggestions().forEach(x => { if (ids.has(x.id)) { DB.players[x.id].rt = { ...x.sug }; n++; } });
      ui.sheet = null; save(); GS.toast(`Updated ratings for ${n} player${n === 1 ? '' : 's'}`);
    },
    tmFromPoll: () => {
      const p = DB.polls.find(x => x.id === document.getElementById('tmPoll').value); if (!p) return;
      const t = T(); t.avail = Object.keys(p.resp).filter(id => p.resp[id] === 'in' && DB.players[id]);
      t.A = t.A.filter(id => t.avail.includes(id)); t.B = t.B.filter(id => t.avail.includes(id)); if (!t.avail.includes(t.common)) t.common = null;
      save(); GS.toast(`${t.avail.length} players from “${p.title}” in the pool`);
    },
    tmMove: d => {
      const t = T(); const inA = t.A.includes(d.id);
      if (t.locks[d.id]) delete t.locks[d.id];
      t.A = t.A.filter(x => x !== d.id); t.B = t.B.filter(x => x !== d.id);
      (inA ? t.B : t.A).push(d.id); save(); GS.render();
    },
    tmDrop: d => { const t = T(); t.A = t.A.filter(x => x !== d.id); t.B = t.B.filter(x => x !== d.id); t.avail = t.avail.filter(x => x !== d.id); t.sel = t.sel.filter(x => x !== d.id); if (t.common === d.id) t.common = null; save(); GS.render(); },
    tmAll: d => { const t = T(); t.avail = d.k === '1' ? GS.pool().map(p => p.id) : []; if (d.k !== '1') { t.A = []; t.B = []; t.common = null; } save(); GS.render(); },
    tmAdd: () => {
      const inp = document.getElementById('tmNew'), t = T();
      const names = inp.value.split(/[,\n]/).map(x => x.trim()).filter(Boolean); if (!names.length) return;
      names.forEach(n => { const id = playerByName(n); if (!t.avail.includes(id)) t.avail.push(id); });
      save(); GS.render();
    },
    tmPreset: d => { const t = T(); t.w = { ...PRESETS[d.k] }; save(); GS.render(); },
    tmLoad: d => {
      const a = DB.teams[+document.getElementById('tmLA').value], b = DB.teams[+document.getElementById('tmLB').value];
      if (!a || !b || a === b) return GS.toast('Pick two different saved teams');
      const t = T(), common = a.players.filter(id => b.players.includes(id));
      t.nameA = a.name; t.nameB = b.name;
      t.A = [...a.players]; t.B = [...b.players]; t.common = common[0] || null; t.sel = [];
      t.avail = [...new Set([...t.avail, ...a.players, ...b.players])];
      if (d.k === 'mix') { t.avail = [...new Set([...a.players, ...b.players])]; reshuffle(false); }
      else { save(); GS.toast('Loaded – tick players to redistribute'); }
    },
    tmSave: () => {
      const t = T();
      [['nameA', 'A'], ['nameB', 'B']].forEach(([n, k]) => {
        const rec = { name: t[n], players: [...t[k]] }, i = DB.teams.findIndex(x => x.name.toLowerCase() === t[n].toLowerCase());
        if (i >= 0) DB.teams[i] = rec; else DB.teams.push(rec);
      });
      save(); GS.toast('Both teams saved');
    },
    tmUse: () => {
      const t = T(); if (!t.A.length || !t.B.length) return GS.toast('Make teams first');
      ui.prefill = { fromTm: true, tA: t.nameA, tB: t.nameB, pA: t.A.map(nm).join('\n'), pB: t.B.map(nm).join('\n'), rules: Object.assign({}, GS.lastRules?.() || {}, { common: !!t.common }) };
      ui.view = 'setup'; GS.render();
    },
    tmSet: (d, el) => { const t = T(), v = +el.value; if (d.k.startsWith('w.')) t.w[d.k.slice(2)] = v; else t[d.k] = v; save(); GS.render(); },
    tmRate: (d, el) => { rating(d.id)[d.k] = +el.value; save(); GS.render(); },
    tmAvail: (d, el) => {
      const t = T();
      if (el.checked) { if (!t.avail.includes(d.id)) t.avail.push(d.id); }
      else { t.avail = t.avail.filter(x => x !== d.id); t.A = t.A.filter(x => x !== d.id); t.B = t.B.filter(x => x !== d.id); t.sel = t.sel.filter(x => x !== d.id); if (t.common === d.id) t.common = null; }
      save(); GS.render();
    },
    tmLock: (d, el) => {
      const t = T();
      if (el.value) {
        t.locks[d.id] = el.value;
        if (d.id !== t.common && (t.A.includes(d.id) || t.B.includes(d.id))) { t.A = t.A.filter(x => x !== d.id); t.B = t.B.filter(x => x !== d.id); t[el.value].push(d.id); }
      } else delete t.locks[d.id];
      save(); GS.render();
    },
    tmSel: (d, el) => { const t = T(); t.sel = el.checked ? [...new Set([...t.sel, d.id])] : t.sel.filter(x => x !== d.id); save(); GS.render(); },
    tmName: (d, el) => { T()['name' + d.k] = el.value.trim() || 'Team ' + d.k; save(); },
    tmFlag: (d, el) => { T()[d.k] = el.checked; save(); GS.render(); },
  });

  return { solve, profile, statRatings, formRatings, suggestions, autoUpdate, T };
})();

