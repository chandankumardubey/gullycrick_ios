/* Gully Scorer – Solo battle: no teams. Everyone bats alone for N overs in a random order; highest score wins.
   Re-rank and replay (everyone / top 3 / without the winner), tie-break overs, series standings, audited score edits. */
'use strict';
const Solo = (() => {
  const { DB, ui, esc, nm, short, save, V, S, A, playerByName } = GS;
  const toast = t => GS.toast(t), draw = () => GS.render();

  // ---------- helpers ----------
  const shuffle = a => { a = a.slice(); const r = new Uint32Array(a.length); (window.crypto || window.msCrypto).getRandomValues(r); for (let i = a.length - 1; i > 0; i--) { const j = r[i] % (i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const ovs = b => Math.floor(b / 6) + '.' + (b % 6);
  const parseOvers = str => { const x = /^\s*(\d+)(?:\.(\d))?\s*$/.exec(String(str)); if (!x) return null; const b = +(x[2] || 0); return b > 5 ? null : +x[1] * 6 + b; };
  const sgn = n => (n > 0 ? '+' : '') + n;
  const getSolo = id => DB.solos.find(x => x.id === id);
  const curSolo = () => getSolo(ui.soloId) || getSolo(DB.soloCur);
  const roundOf = s => (ui.soloR != null && s.rounds[ui.soloR]) ? s.rounds[ui.soloR] : s.rounds[s.rounds.length - 1];
  const limitOf = (s, r) => (r.balls != null ? r.balls : s.balls);
  const turnOf = (r, id) => r.turns[id] || (r.turns[id] = { ev: [], adj: [], ended: false });
  const MEDAL = ['🥇', '🥈', '🥉'];

  function stats(s, r, id) {
    const T = r.turns[id] || { ev: [], adj: [] };
    let runs = 0, balls = 0, wkts = 0, f4 = 0, f6 = 0, extras = 0;
    T.ev.forEach(e => {
      if (e.x) { runs += s.extra; extras++; return; }
      balls++; runs += e.r; if (e.r === 4) f4++; if (e.r === 6) f6++;
      if (e.w) { wkts++; if (s.wk === 'penalty') runs -= s.penalty; }
    });
    (T.adj || []).forEach(a => { runs += a.r || 0; balls += a.b || 0; wkts += a.w || 0; });
    return { id, runs, balls, wkts, f4, f6, extras, sr: balls ? runs * 100 / balls : 0 };
  }
  function turnDone(s, r, id) {
    const T = r.turns[id]; if (!T) return false;
    const st = stats(s, r, id);
    return !!T.ended || st.balls >= limitOf(s, r) || (s.wk === 'end' && st.wkts >= 1);
  }
  const activeId = (s, r) => r.order.find(id => !turnDone(s, r, id));
  function advance(s, r) {
    const all = r.players.every(id => turnDone(s, r, id));
    if (all && r.status === 'play') r.status = 'done'; else if (!all && r.status === 'done') r.status = 'play';
  }
  const cmp = (a, b) => b.runs - a.runs || a.wkts - b.wkts || b.sr - a.sr;
  const eq = (a, b) => a.runs === b.runs && a.wkts === b.wkts && a.balls === b.balls;

  // ranking (ties are refined by completed tie-break rounds)
  function ranked(s, r) {
    const rows = r.players.map(id => ({ id, st: stats(s, r, id) })).sort((a, b) => cmp(a.st, b.st) || nm(a.id).localeCompare(nm(b.id)));
    const out = []; let i = 0;
    while (i < rows.length) {
      let j = i; while (j + 1 < rows.length && eq(rows[j + 1].st, rows[i].st)) j++;
      const grp = rows.slice(i, j + 1), pos = i + 1;
      const tb = grp.length > 1 ? s.rounds.find(x => x.tb === r.no && x.status === 'done' && x.players.length === grp.length && grp.every(g => x.players.includes(g.id))) : null;
      if (tb) ranked(s, tb).forEach(x => out.push({ id: x.id, st: grp.find(g => g.id === x.id).st, rank: pos + x.rank - 1, tied: x.tied, tb: true }));
      else grp.forEach(g => out.push({ id: g.id, st: g.st, rank: pos, tied: grp.length > 1 }));
      i = j + 1;
    }
    return out;
  }
  function tieGroups(s, r) {
    const rk = ranked(s, r), by = {};
    rk.filter(x => x.tied && !x.tb).forEach(x => { (by[x.rank] || (by[x.rank] = [])).push(x.id); });
    return Object.entries(by).map(([rank, ids]) => ({ rank: +rank, ids }));
  }
  const baseRound = s => [...s.rounds].reverse().find(r => !r.tb && r.status === 'done');
  const rankTxt = x => (x.tied ? 'T-' : '') + x.rank;
  function series(s) {
    const m = {};
    s.rounds.filter(r => !r.tb && r.status === 'done').forEach(r => {
      const rk = ranked(s, r), n = rk.length;
      rk.forEach(x => {
        const p = m[x.id] || (m[x.id] = { id: x.id, rounds: 0, wins: 0, pts: 0, runs: 0, balls: 0, best: -Infinity });
        p.rounds++; p.runs += x.st.runs; p.balls += x.st.balls; p.pts += n - x.rank + 1; p.best = Math.max(p.best, x.st.runs); if (x.rank === 1) p.wins++;
      });
    });
    return Object.values(m).sort((a, b) => b.wins - a.wins || b.pts - a.pts || b.runs - a.runs);
  }
  const label = e => (e.x ? (e.x === 'wd' ? 'Wd' : 'Nb') : e.w ? (e.r ? e.r + 'W' : 'W') : String(e.r));
  const newRound = (s, players, order, extra = {}) => Object.assign({ no: s.rounds.length + 1, tb: null, players: players.slice(), order: order.slice(), turns: {}, status: 'order' }, extra);
  const rulesTxt = s => `${ovs(s.balls)} overs each · ${s.wk === 'penalty' ? `out = −${s.penalty} runs, batting continues` : 'out ends the turn'}${s.extras ? ' · wd/nb +' + s.extra : ''}`;
  function auditPending(s) { return (s.audit || []).filter(a => a.kind === 'adj' && a.status === 'pending').length; }
  function sAudit(s, rec) { (s.audit || (s.audit = [])).push(Object.assign({ id: GS.uid(), ts: Date.now() }, rec)); }

  // ================= LIST =================
  V.solo = () => {
    const list = DB.solos.slice().reverse();
    return `${GS.header('Solo battle')}<main>
      <div class="card hero"><b>🧍 No teams? Everyone plays for themselves.</b><div class="small">Players bat one at a time in a random order for a set number of overs. Highest score wins – then re-rank and play again.</div></div>
      <button type="button" class="btn primary block xl" data-act="soloNew">＋ New solo battle</button>
      ${list.map(s => {
        const done = baseRound(s), w = done ? ranked(s, done).filter(x => x.rank === 1) : [];
        return `<div class="card tap" data-act="soloResume" data-id="${s.id}"><div class="row between muted small"><span>${new Date(s.created).toLocaleString()}</span>${s.status === 'live' ? '<span class="pill red">LIVE</span>' : ''}</div>
          <div class="big">${esc(s.title || 'Solo battle')}</div><div class="small">${s.players.length} players · ${s.rounds.length} round${s.rounds.length > 1 ? 's' : ''} · ${esc(rulesTxt(s))}</div>
          ${w.length ? `<div class="result">🥇 ${esc(w.map(x => nm(x.id)).join(' & '))}${w.length === 1 ? ` – ${w[0].st.runs} (${w[0].st.balls})` : ''}</div>` : ''}
          <div class="row gap mt"><button type="button" class="btn sm danger" data-act="soloDel" data-id="${s.id}" aria-label="Delete">✕ Delete</button></div></div>`;
      }).join('') || '<p class="muted center">No solo battles yet.</p>'}</main>`;
  };

  // ================= SETUP =================
  function capForm() {
    const v = id => document.getElementById(id);
    if (!v('soloOvers')) return ui.soloForm || {};
    const f = ui.soloForm = ui.soloForm || {};
    f.title = v('soloTitle').value; f.overs = v('soloOvers').value; f.wk = v('soloWk').value; f.penalty = v('soloPen').value; f.extras = v('soloExtras').checked;
    f.sel = [...document.querySelectorAll('.spk:checked')].map(x => x.value);
    return f;
  }
  V.soloNew = () => {
    const f = ui.soloForm || (ui.soloForm = { title: '', overs: '2', wk: 'end', penalty: '5', extras: true, sel: [] });
    const pool = GS.pool().sort((a, b) => a.name.localeCompare(b.name)), sel = new Set(f.sel);
    return `${GS.header('New solo battle')}<main>
      <div class="card"><label>Players <span class="muted small" id="soloCount">(${sel.size} selected)</span></label>
        <div class="chips">${pool.map(p => `<label class="chipchk"><input type="checkbox" class="spk" value="${p.id}" data-chg="soloPick" ${sel.has(p.id) ? 'checked' : ''}> ${esc(p.name)}</label>`).join('') || '<span class="muted small">Your player pool is empty – add names below.</span>'}</div>
        <div class="row gap mt"><button type="button" class="btn sm" data-act="soloSel" data-k="all">All</button><button type="button" class="btn sm" data-act="soloSel" data-k="none">None</button></div>
        <div class="row gap mt"><input id="soloAddNames" placeholder="Add new players (comma separated)" aria-label="New players"><button type="button" class="btn" data-act="soloAddNames">Add</button></div></div>
      <div class="card"><label for="soloTitle">Title (optional)</label><input id="soloTitle" maxlength="40" value="${esc(f.title)}" placeholder="Sunday solo showdown">
        <label for="soloOvers">Overs for each player (e.g. 2 or 1.3)</label><input id="soloOvers" inputmode="decimal" value="${esc(f.overs)}">
        <label for="soloWk">When a batter is out</label><select id="soloWk"><option value="end" ${f.wk === 'end' ? 'selected' : ''}>Their turn ends</option><option value="penalty" ${f.wk === 'penalty' ? 'selected' : ''}>Lose runs and keep batting</option></select>
        <label for="soloPen">Runs lost per wicket (only if “lose runs”)</label><input id="soloPen" type="number" min="0" max="50" value="${esc(f.penalty)}">
        <label class="chk"><input type="checkbox" id="soloExtras" ${f.extras ? 'checked' : ''}> Wide / No-ball give +1 run and are re-bowled</label></div>
      <button type="button" class="btn primary block xl" data-act="soloStart">🎲 Draw batting order ▶</button></main>`;
  };

  // ================= PLAY / ORDER / RESULTS =================
  const roundTabs = s => s.rounds.length > 1 ? `<div class="chips mt">${s.rounds.map((r, i) => `<button type="button" class="tog sm ${r === roundOf(s) ? 'sel' : ''}" data-act="soloRound" data-i="${i}">${r.tb ? '⚡ Tie-break' : 'Round ' + r.no}</button>`).join('')}</div>` : '';
  V.soloPlay = () => {
    const s = curSolo(); if (!s) { ui.view = 'solo'; return V.solo(); }
    const r = roundOf(s), title = (s.title || 'Solo battle') + ' · ' + (r.tb ? 'Tie-break' : 'Round ' + r.no);
    if (r.status === 'order') {
      return `${GS.header(title)}<main><div class="card"><h4>🎲 Batting order</h4>
        <ol class="solo-order">${r.order.map((id, k) => `<li class="reveal" style="animation-delay:${k * 110}ms"><span class="num">${k + 1}</span><b class="grow">${esc(nm(id))}</b>
          <button type="button" class="btn sm" data-act="soloMove" data-i="${k}" data-dir="-1" ${k ? '' : 'disabled'} aria-label="Move up">▲</button><button type="button" class="btn sm" data-act="soloMove" data-i="${k}" data-dir="1" ${k < r.order.length - 1 ? '' : 'disabled'} aria-label="Move down">▼</button>
          <button type="button" class="btn sm danger" data-act="soloDrop" data-id="${id}" ${r.order.length > 2 ? '' : 'disabled'} aria-label="Remove ${esc(nm(id))} from this round">✕</button></li>`).join('')}</ol>
        <p class="muted small">${r.players.length} players · ${esc(rulesTxt({ ...s, balls: limitOf(s, r) }))}</p>
        <div class="row gap"><button type="button" class="btn" data-act="soloShuffle">🎲 Shuffle again</button><button type="button" class="btn primary grow" data-act="soloGo">Start round ▶</button></div></div>${roundTabs(s)}</main>`;
    }
    if (r.status === 'done') return resultsView(s, r, title);
    const id = activeId(s, r), st = stats(s, r, id), T = r.turns[id] || { ev: [] }, idx = r.order.indexOf(id), lim = limitOf(s, r);
    const chips = T.ev.slice(-12).map(e => `<span class="chip ${e.w ? 'w' : e.r === 4 ? 'b4' : e.r === 6 ? 'b6' : ''}">${esc(label(e))}</span>`).join('');
    return `${GS.header(title)}<main class="scoring">
      <section class="scorebox" aria-live="polite"><div class="row between small"><span>Turn ${idx + 1} of ${r.order.length}</span><span>${esc(rulesTxt({ ...s, balls: lim }))}</span></div>
        <div class="big">🏏 ${esc(nm(id))}</div><div class="score">${st.runs}<span>/${st.wkts}</span> <small>(${ovs(st.balls)}/${ovs(lim)})</small></div>
        <div class="over">${chips || '<span class="muted small">Ready – first ball!</span>'}</div></section>
      <section class="pad"><div class="runs">${[0, 1, 2, 3, 4, 5, 6].map(n => `<button type="button" class="run ${n === 4 ? 'four' : n === 6 ? 'six' : ''}" data-act="soloRun" data-n="${n}">${n}</button>`).join('')}</div>
        <div class="toggles">${s.extras ? '<button type="button" class="tog" data-act="soloX" data-k="wd">Wide +' + s.extra + '</button><button type="button" class="tog" data-act="soloX" data-k="nb">No ball +' + s.extra + '</button>' : ''}<button type="button" class="tog wk sel" data-act="soloOut">OUT</button></div>
        ${X.voiceUI()}
        <div class="row gap"><button type="button" class="btn" data-act="soloUndo">↶ Undo</button><button type="button" class="btn mic ${ui.voice.on ? 'on' : ''}" data-act="voiceToggle" aria-label="${ui.voice.on ? 'Stop voice scoring' : 'Start voice scoring'}" aria-pressed="${ui.voice.on}">🎤</button><button type="button" class="btn" data-act="soloEnd">⏹ End turn</button><button type="button" class="btn" data-act="soloAdjOpen">⚙</button></div></section>
      <div class="card tight"><h4>Order</h4>${r.order.map((p, k) => { const d = turnDone(s, r, p), q = stats(s, r, p); return `<div class="row between small ${p === id ? 'on' : ''}"><span>${k + 1}. ${p === id ? '▶ ' : ''}${esc(nm(p))}</span><b>${d ? `${q.runs}${q.wkts ? ' (' + q.wkts + 'w)' : ''} · ${q.balls}b` : p === id ? 'batting' : '–'}</b></div>`; }).join('')}</div>${roundTabs(s)}</main>`;
  };
  function resultsView(s, r, title) {
    const rk = ranked(s, r), top = rk.filter(x => x.rank === 1), ties = tieGroups(s, r), sr = series(s), pend = auditPending(s);
    const row = x => `<tr class="${x.rank === 1 ? 'on' : ''}"><td>${MEDAL[x.rank - 1] || ''} ${rankTxt(x)}</td><td>${esc(nm(x.id))}${x.tb ? ' <span class="pill green">tie-break</span>' : ''}</td><td><b>${x.st.runs}</b></td><td>${x.st.balls}</td><td>${x.st.sr.toFixed(0)}</td><td>${x.st.f4}/${x.st.f6}</td><td>${x.st.wkts}</td></tr>`;
    const headline = top.length === 1 ? `🥇 <b>${esc(nm(top[0].id))}</b> wins with ${top[0].st.runs} (${top[0].st.balls})` : `🤝 Tie for 1st: <b>${esc(top.map(x => nm(x.id)).join(' & '))}</b> – ${top[0].st.runs} each`;
    const podium = rk.length > 1 ? `<div class="muted small">${rk.filter(x => x.rank === 2).length ? '🥈 Runner-up: ' + esc(rk.filter(x => x.rank === 2).map(x => nm(x.id)).join(', ')) : ''}${rk.filter(x => x.rank === 3).length ? ' · 🥉 Third: ' + esc(rk.filter(x => x.rank === 3).map(x => nm(x.id)).join(', ')) : ''}</div>` : '';
    return `${GS.header(title + ' · results')}<main>
      <div class="card hero"><div class="big">${headline}</div>${podium}</div>
      <div class="card tight"><table class="t full"><tr><th>#</th><th>Player</th><th>Runs</th><th>B</th><th>SR</th><th>4/6</th><th>W</th></tr>${rk.map(row).join('')}</table></div>
      ${ties.map((g, k) => `<div class="card tight warn"><span>🤝 Tied for ${g.rank === 1 ? '1st' : 'position ' + g.rank}: ${esc(g.ids.map(nm).join(', '))}</span><button type="button" class="btn sm primary" data-act="soloTie" data-k="${k}">⚡ Tie-break over</button></div>`).join('')}
      ${pend ? `<div class="card tight warn"><span>⚠ ${pend} score adjustment${pend > 1 ? 's' : ''} not reviewed</span><button type="button" class="btn sm" data-act="soloAudit">🧾 Review</button></div>` : ''}
      <div class="row gap wrap"><button type="button" class="btn primary grow" data-act="soloNextOpen">▶ Next round…</button><button type="button" class="btn" data-act="soloFinish">✔ Finish</button></div>
      <div class="row gap wrap mt"><button type="button" class="btn" data-act="soloUndo">↶ Undo last ball</button><button type="button" class="btn" data-act="soloAdjOpen">⚙ Adjust score</button><button type="button" class="btn" data-act="soloShare">📤 Share</button></div>
      ${s.rounds.filter(x => !x.tb && x.status === 'done').length > 1 ? `<details id="dSer" class="card" open><summary>📊 Series standings</summary><table class="t full"><tr><th>Player</th><th>Rds</th><th>Wins</th><th>Pts</th><th>Runs</th><th>Best</th></tr>${sr.map(p => `<tr><td>${esc(nm(p.id))}</td><td>${p.rounds}</td><td>${p.wins}</td><td>${p.pts}</td><td>${p.runs}</td><td>${p.best}</td></tr>`).join('')}</table><p class="muted tiny">Points per round = players − rank + 1.</p></details>` : ''}
      ${(s.audit || []).length ? `<details id="dSAud" class="card"><summary>🧾 Audit log (${s.audit.length})</summary>${auditHtml(s, false)}</details>` : ''}
      ${roundTabs(s)}</main>`;
  }
  const auditHtml = (s, interactive) => (s.audit || []).slice().reverse().map(a => `<div class="aud ${a.status}"><div class="row between small"><b>${a.kind === 'revert' ? '↩ Reverted' : '⚙ Score adjustment'}</b><span class="pill">${({ pending: '⏳ to review', ok: '✅ approved', reverted: '↩ reverted', info: 'ℹ note' })[a.status] || ''}</span></div>
      <div class="muted tiny">${new Date(a.ts).toLocaleString()} · round ${a.round} · ${esc(a.name)}</div><div>${esc(a.reason)}</div>${(a.detail || []).map(d => `<div class="small">• ${esc(d)}</div>`).join('')}
      ${interactive && a.status === 'pending' ? `<div class="row gap mt"><button type="button" class="btn sm primary" data-act="soloAudOk" data-id="${a.id}">✔ Approve</button><button type="button" class="btn sm danger" data-act="soloAudRevert" data-id="${a.id}">↩ Revert</button></div>` : ''}</div>`).join('') || '<p class="muted small">No adjustments.</p>';

  // ================= SHEETS =================
  const capNext = () => { const n = ui.soloNext; if (!n) return; const m = document.getElementById('sn_mode'), o = document.getElementById('sn_overs'); if (m) n.mode = m.value; if (o) n.overs = o.value; };
  S.soloNext = () => {
    const s = curSolo(), base = baseRound(s), n = ui.soloNext, rk = ranked(s, base), sel = new Set(n.sel);
    return `<h3>Next round</h3><p class="muted small">Pick who plays and how the batting order is set.</p>
      <div class="row gap wrap"><button type="button" class="btn sm" data-act="soloNPre" data-k="all">Everyone</button><button type="button" class="btn sm" data-act="soloNPre" data-k="top3">Top 3 (final)</button><button type="button" class="btn sm" data-act="soloNPre" data-k="nowin">Without the winner</button></div>
      <div class="chips mt">${rk.map(x => `<label class="chipchk"><input type="checkbox" data-chg="soloNPick" data-id="${x.id}" ${sel.has(x.id) ? 'checked' : ''}> ${MEDAL[x.rank - 1] || x.rank + '.'} ${esc(nm(x.id))} <small>${x.st.runs}</small></label>`).join('')}</div>
      <label for="sn_mode">Batting order</label><select id="sn_mode"><option value="random" ${n.mode === 'random' ? 'selected' : ''}>🎲 Random</option><option value="worst" ${n.mode === 'worst' ? 'selected' : ''}>Lowest scorer first (best bats last)</option><option value="best" ${n.mode === 'best' ? 'selected' : ''}>Best scorer first</option><option value="same" ${n.mode === 'same' ? 'selected' : ''}>Same order as last round</option></select>
      <label for="sn_overs">Overs for each player</label><input id="sn_overs" inputmode="decimal" value="${esc(n.overs)}">
      <div class="row gap mt"><button type="button" class="btn" data-act="closeSheet">Cancel</button><button type="button" class="btn primary grow" data-act="soloNGo">Create round ▶</button></div>`;
  };
  S.soloAdj = () => {
    const s = curSolo(), r = roundOf(s), sh = ui.sheet, id = r.players.includes(sh.pid) ? sh.pid : r.players[0], st = stats(s, r, id), D = sh.draft || {};
    const v0 = (k, d) => (D[k] !== undefined ? D[k] : d);
    return `<h3>⚙ Adjust a score</h3><p class="muted small">Type the <b>correct</b> figures for ${r.tb ? 'this tie-break' : 'round ' + r.no}. The change is logged for review.</p>
      <label for="sa_p">Player</label><select id="sa_p" data-chg="soloAdjPid">${r.players.map(p => `<option value="${p}" ${p === id ? 'selected' : ''}>${esc(nm(p))}</option>`).join('')}</select>
      <div class="grid3"><div><label for="sa_r">Runs</label><input id="sa_r" type="number" class="nin" value="${esc(v0('sa_r', st.runs))}"></div><div><label for="sa_b">Overs</label><input id="sa_b" class="nin" inputmode="decimal" value="${esc(v0('sa_b', ovs(st.balls)))}"></div><div><label for="sa_w">Wickets</label><input id="sa_w" type="number" class="nin" value="${esc(v0('sa_w', st.wkts))}"></div></div>
      <label for="sa_rs">Reason (required)</label><select id="sa_rs">${['Missed scoring', 'Wrong entry corrected', 'Dispute settled', 'Other'].map(x => `<option ${v0('sa_rs', 'Missed scoring') === x ? 'selected' : ''}>${x}</option>`).join('')}</select>
      <input id="sa_n" placeholder="Note (required for “Other”)" maxlength="100" value="${esc(v0('sa_n', ''))}" aria-label="Note">
      <div class="row gap mt"><button type="button" class="btn" data-act="closeSheet">Cancel</button><button type="button" class="btn primary grow" data-act="soloAdjSave">Save adjustment</button></div>`;
  };
  S.soloAudit = () => { const s = curSolo(), p = auditPending(s); return `<h3>🧾 Audit log</h3>${p ? `<button type="button" class="btn block" data-act="soloAudAll">✔ Approve all ${p}</button>` : ''}<div class="audlist">${auditHtml(s, true)}</div><button type="button" class="btn primary block" data-act="closeSheet">Done</button>`; };

  // ================= ACTIONS =================
  function afterBall(s, r, id) {
    advance(s, r); save();
    if (r.status === 'done') toast('Round complete 🎉');
    else if (turnDone(s, r, id)) { const q = stats(s, r, id); toast(`${nm(id)}: ${q.runs} (${q.balls}) – next: ${nm(activeId(s, r))}`); }
    draw();
  }
  function ball(ev) {
    const s = curSolo(), r = roundOf(s); if (r.status !== 'play') return; const id = activeId(s, r); if (!id) return;
    turnOf(r, id).ev.push(ev); if (navigator.vibrate) navigator.vibrate(15); afterBall(s, r, id);
  }
  Object.assign(A, {
    soloNew: () => { ui.soloForm = null; ui.view = 'soloNew'; window.scrollTo(0, 0); draw(); },
    soloPick: () => { const n = document.querySelectorAll('.spk:checked').length, c = document.getElementById('soloCount'); if (c) c.textContent = `(${n} selected)`; },
    soloSel: d => { document.querySelectorAll('.spk').forEach(x => { x.checked = d.k === 'all'; }); A.soloPick(); },
    soloAddNames: () => {
      const f = capForm(), inp = document.getElementById('soloAddNames'), names = inp.value.split(/[,\n]/).map(x => x.trim()).filter(Boolean);
      if (!names.length) return toast('Type one or more names');
      names.forEach(n => { const id = playerByName(n); if (!f.sel.includes(id)) f.sel.push(id); });
      save(); draw();
    },
    soloStart: () => {
      const f = capForm(), ids = [...new Set(f.sel)].filter(id => DB.players[id]);
      if (ids.length < 2) return toast('Pick at least 2 players');
      const balls = parseOvers(f.overs); if (!balls || balls < 1) return toast('Enter overs like 2 or 1.3');
      const s = { id: GS.uid(), created: Date.now(), status: 'live', title: (f.title || '').trim(), balls, wk: f.wk === 'penalty' ? 'penalty' : 'end', penalty: Math.max(0, +f.penalty || 0), extras: !!f.extras, extra: 1, players: ids, rounds: [], audit: [] };
      s.rounds.push(newRound(s, ids, shuffle(ids), { mode: 'random' }));
      DB.solos.push(s); DB.soloCur = s.id; ui.soloId = s.id; ui.soloR = null; ui.soloForm = null; ui.view = 'soloPlay'; save(); window.scrollTo(0, 0); draw();
    },
    soloResume: d => { ui.soloId = d.id; ui.soloR = null; ui.view = 'soloPlay'; window.scrollTo(0, 0); draw(); },
    soloDel: d => { if (!confirm('Delete this solo battle permanently?')) return; DB.solos = DB.solos.filter(x => x.id !== d.id); if (DB.soloCur === d.id) DB.soloCur = null; save(); draw(); },
    soloRound: d => { ui.soloR = +d.i; draw(); },
    soloShuffle: () => { const s = curSolo(), r = roundOf(s); r.order = shuffle(r.order); save(); draw(); },
    soloMove: d => { const r = roundOf(curSolo()), i = +d.i, j = i + +d.dir; if (j < 0 || j >= r.order.length) return; [r.order[i], r.order[j]] = [r.order[j], r.order[i]]; save(); draw(); },
    soloDrop: d => { const r = roundOf(curSolo()); if (r.order.length <= 2) return; r.order = r.order.filter(x => x !== d.id); r.players = r.players.filter(x => x !== d.id); save(); draw(); },
    soloGo: () => { const s = curSolo(), r = roundOf(s); r.status = 'play'; save(); draw(); },
    soloRun: d => ball({ r: +d.n }),
    soloX: d => ball({ x: d.k, r: 0 }),
    soloOut: () => ball({ r: 0, w: true }),
    soloEnd: () => { const s = curSolo(), r = roundOf(s), id = activeId(s, r); if (!id || !confirm(`End ${nm(id)}'s turn now?`)) return; turnOf(r, id).ended = true; afterBall(s, r, id); },
    soloUndo: () => {
      const s = curSolo(), r = roundOf(s), has = p => r.turns[p] && (r.turns[p].ev.length || r.turns[p].ended);
      let id;
      if (r.status === 'done') id = [...r.order].reverse().find(has);
      else { const a = activeId(s, r); id = has(a) ? a : r.order.slice(0, Math.max(0, r.order.indexOf(a))).reverse().find(has); }
      if (!id) return toast('Nothing to undo');
      const T = r.turns[id]; if (T.ended) T.ended = false; else T.ev.pop();
      advance(s, r); if (r.status === 'done') r.status = 'play'; save(); draw();
    },
    soloNextOpen: () => {
      const s = curSolo(), base = baseRound(s) || roundOf(s);
      ui.soloNext = { sel: base.players.slice(), mode: 'random', overs: ovs(s.balls) }; ui.sheet = { type: 'soloNext' }; draw();
    },
    soloNPre: d => {
      capNext(); const s = curSolo(), rk = ranked(s, baseRound(s)), n = ui.soloNext;
      n.sel = d.k === 'all' ? rk.map(x => x.id) : d.k === 'top3' ? rk.filter(x => x.rank <= 3).map(x => x.id) : rk.filter(x => x.rank > 1).map(x => x.id);
      draw();
    },
    soloNPick: (d, el) => { capNext(); const n = ui.soloNext; n.sel = el.checked ? [...new Set([...n.sel, d.id])] : n.sel.filter(x => x !== d.id); draw(); },
    soloNGo: () => {
      capNext(); const s = curSolo(), base = baseRound(s), n = ui.soloNext, ids = n.sel.filter(id => base.players.includes(id));
      if (ids.length < 2) return toast('Pick at least 2 players');
      const balls = parseOvers(n.overs); if (!balls || balls < 1) return toast('Enter overs like 2 or 1.3');
      const rk = ranked(s, base), pos = id => rk.find(x => x.id === id)?.rank ?? 99;
      let order;
      if (n.mode === 'best') order = ids.slice().sort((a, b) => pos(a) - pos(b));
      else if (n.mode === 'worst') order = ids.slice().sort((a, b) => pos(b) - pos(a));
      else if (n.mode === 'same') order = base.order.filter(id => ids.includes(id));
      else order = shuffle(ids);
      s.rounds.push(newRound(s, ids, order, { mode: n.mode, ...(balls !== s.balls ? { balls } : {}) }));
      ui.soloR = null; ui.sheet = null; save(); window.scrollTo(0, 0); draw();
    },
    soloTie: d => {
      const s = curSolo(), r = roundOf(s), g = tieGroups(s, r)[+d.k]; if (!g) return;
      s.rounds.push(newRound(s, g.ids, shuffle(g.ids), { tb: r.no, mode: 'random', balls: 6 })); ui.soloR = null; save(); window.scrollTo(0, 0); draw();
    },
    soloFinish: () => {
      const s = curSolo(); if (auditPending(s) && !confirm(`${auditPending(s)} score adjustment(s) are not reviewed.\n\nOK = finish anyway (review later from the list)\nCancel = go back`)) return;
      s.status = 'done'; if (DB.soloCur === s.id) DB.soloCur = null; save(); ui.view = 'solo'; draw();
    },
    soloShare: () => {
      const s = curSolo(), r = roundOf(s), L = [`🧍 ${s.title || 'Solo battle'} – ${r.tb ? 'tie-break' : 'round ' + r.no}`];
      ranked(s, r).forEach(x => L.push(`${MEDAL[x.rank - 1] || x.rank + '.'} ${nm(x.id)} ${x.st.runs} (${x.st.balls})${x.st.wkts ? ' ' + x.st.wkts + 'w' : ''}`));
      if (auditPending(s) || (s.audit || []).some(a => a.kind === 'adj')) L.push('⚠ Includes manual score adjustments');
      const txt = L.join('\n');
      if (navigator.share) navigator.share({ text: txt }).catch(() => { }); else if (navigator.clipboard) navigator.clipboard.writeText(txt).then(() => toast('Results copied')); else toast(txt);
    },
    soloAdjOpen: () => { const s = curSolo(), r = roundOf(s); ui.sheet = { type: 'soloAdj', pid: activeId(s, r) || r.players[0], draft: {} }; draw(); },
    soloAdjPid: (d, el) => { ui.sheet.pid = el.value; ui.sheet.draft = { sa_rs: document.getElementById('sa_rs')?.value, sa_n: document.getElementById('sa_n')?.value }; draw(); },
    soloAdjSave: () => {
      const s = curSolo(), r = roundOf(s), v = id => document.getElementById(id).value, id = v('sa_p'), st = stats(s, r, id);
      const runs = Number(v('sa_r')), balls = parseOvers(v('sa_b')), wk = Number(v('sa_w'));
      if (!Number.isFinite(runs) || !Number.isInteger(wk) || wk < 0 || balls == null) return toast('Enter valid numbers (overs like 1.3)');
      const reasonSel = v('sa_rs'), note = v('sa_n').trim(); if (reasonSel === 'Other' && !note) return toast('Please add a note for “Other”');
      const d = { r: Math.round(runs) - st.runs, b: balls - st.balls, w: wk - st.wkts };
      if (!d.r && !d.b && !d.w) return toast('Nothing changed');
      const detail = [d.r && `runs ${st.runs} → ${Math.round(runs)}`, d.b && `overs ${ovs(st.balls)} → ${ovs(balls)}`, d.w && `wickets ${st.wkts} → ${wk}`].filter(Boolean), reason = reasonSel + (note ? ': ' + note : '');
      if (!confirm(`Record this adjustment for ${nm(id)}?\n\n${detail.join('\n')}\n\nReason: ${reason}\nIt will be logged for review.`)) return;
      const aid = GS.uid(); turnOf(r, id).adj.push({ aid, ...d });
      sAudit(s, { kind: 'adj', aid, round: r.no, pid: id, name: nm(id), reason, detail, status: 'pending' });
      advance(s, r); ui.sheet = null; save(); draw(); toast('Adjustment saved & logged ✔');
    },
    soloAudit: () => { ui.sheet = { type: 'soloAudit' }; draw(); },
    soloAudOk: d => { const a = curSolo().audit.find(x => x.id === d.id); if (a) a.status = 'ok'; save(); draw(); },
    soloAudAll: () => { (curSolo().audit || []).forEach(a => { if (a.status === 'pending') a.status = 'ok'; }); save(); draw(); },
    soloAudRevert: d => {
      const s = curSolo(), a = s.audit.find(x => x.id === d.id), r = s.rounds.find(x => x.no === a?.round), T = r?.turns[a.pid], o = T?.adj.find(x => x.aid === a.aid);
      if (!o) return toast('Cannot revert this one'); if (!confirm('Revert this adjustment? A reversing entry is logged.')) return;
      const aid = GS.uid(); T.adj.push({ aid, r: -o.r, b: -o.b, w: -o.w, rev: a.aid }); a.status = 'reverted';
      sAudit(s, { kind: 'revert', aid, round: a.round, pid: a.pid, name: a.name, reason: 'Reverted: ' + a.reason, status: 'info', detail: [] });
      advance(s, r); save(); draw(); toast('Reverted');
    },
  });

  // ================= VOICE (shares the recogniser + read-back engine in extras.js) =================
  const voiceCtx = {
    phrase(cmd) {
      const s = curSolo(), r = s && roundOf(s), id = r && activeId(s, r), who = id ? short(id) : '';
      if (cmd.cmd === 'undo') return 'Undo the last ball';
      if (cmd.cmd === 'swap') return 'Swap strike (not used in solo)';
      if (cmd.ex === 'b' || cmd.ex === 'lb') return (cmd.ex === 'b' ? 'Bye' : 'Leg bye') + ' (not used in solo)';
      if (cmd.ex) return (cmd.ex === 'wd' ? 'Wide' : 'No ball') + ` plus ${s.extra}`;
      if (cmd.w) return `Out – ${who}`;
      const n = cmd.runs ?? 0;
      return (n === 0 ? 'Dot ball' : n === 1 ? '1 run' : n + ' runs') + (who ? ` for ${who}` : '');
    },
    apply(cmd) {
      const s = curSolo(); if (!s) return { state: 'blocked', say: 'No solo battle is open.', short: 'No solo battle open' };
      let r = roundOf(s);
      if (cmd.cmd === 'undo') {
        const before = JSON.stringify(r.turns); A.soloUndo(); r = roundOf(curSolo());
        return JSON.stringify(r.turns) === before ? { state: 'blocked', say: 'There is nothing to undo.', short: 'Nothing to undo' } : { state: 'undo', say: 'Last ball removed.', short: 'Undone' };
      }
      if (cmd.cmd === 'swap' || cmd.ex === 'b' || cmd.ex === 'lb') return { state: 'blocked', say: 'That does not apply in solo play.', short: 'Not applicable in solo play' };
      if (r.status !== 'play') return { state: 'blocked', say: 'Start the round first.', short: 'Round is not in progress' };
      if (cmd.ex && !s.extras) return { state: 'blocked', say: 'Wides and no balls are switched off for this battle.', short: 'Wides / no-balls are off' };
      if ((cmd.runs ?? 0) > 6) return { state: 'blocked', say: 'Runs can be 0 to 6.', short: 'Runs must be 0–6' };
      const id = activeId(s, r), ph = voiceCtx.phrase(cmd);
      ball(cmd.ex ? { x: cmd.ex, r: 0 } : cmd.w ? { r: 0, w: true } : { r: cmd.runs ?? 0 });
      const r2 = roundOf(curSolo()), st = stats(s, r2, id), lim = limitOf(s, r2), fin = turnDone(s, r2, id);
      let say = `${ph}. ${short(id)} ${st.runs}${st.wkts ? ' for ' + st.wkts : ''} off ${st.balls}.`;
      if (fin) say += ` ${short(id)} finished on ${st.runs}.`;
      if (r2.status === 'done') say += ' Round complete.'; else if (fin) say += ` Next up: ${short(activeId(s, r2))}.`;
      return { state: 'ok', say, short: `${nm(id)} ${st.runs}${st.wkts ? '/' + st.wkts : ''} (${ovs(st.balls)}/${ovs(lim)})${fin ? ' · turn over' : ''}` };
    },
  };
  return { stats, ranked, series, tieGroups, turnDone, parseOvers, voiceCtx };
})();
