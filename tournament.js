/* Gully Scorer – Tournaments: round-robin league, points table with NRR, knockouts, Player of the Series */
'use strict';
const Tour = (() => {
  const { DB, ui, esc, nm, short, save, st, pomPoints, playerByName, V, A } = GS;
  const get = id => DB.tours.find(t => t.id === id);
  const fxMatch = f => { const m = f.mid && DB.matches.find(x => x.id === f.mid); return m && m.status === 'done' ? m : null; };
  const liveMatch = f => { const m = f.mid && DB.matches.find(x => x.id === f.mid); return m && m.status === 'live' ? m : null; };

  function roundRobin(n, legs) {
    const ids = [...Array(n).keys()]; if (n % 2) ids.push(null);
    const k = ids.length, rounds = [];
    for (let r = 0; r < k - 1; r++) {
      const pairs = [];
      for (let i = 0; i < k / 2; i++) { const a = ids[i], b = ids[k - 1 - i]; if (a != null && b != null) pairs.push(r % 2 ? [b, a] : [a, b]); }
      rounds.push(pairs); ids.splice(1, 0, ids.pop());
    }
    let out = rounds.flat();
    if (legs === 2) out = out.concat(rounds.flat().map(([a, b]) => [b, a]));
    return out;
  }

  function fxWinner(t, f) {
    const m = fxMatch(f); if (!m) return null;
    const ti = w => (w == null ? null : (w === 0 ? f.a : f.b));
    if (m.result?.winner != null) return ti(m.result.winner);
    return f.stage === 'league' ? null : (f.seedA ?? 0) <= (f.seedB ?? 1) ? f.a : f.b;
  }

  function table(t) {
    const rows = t.teams.map((tm, i) => ({ i, name: tm.name, p: 0, w: 0, l: 0, tie: 0, pts: 0, rf: 0, bf: 0, ra: 0, ba: 0, form: [] }));
    t.fixtures.filter(f => f.stage === 'league').forEach(f => {
      const m = fxMatch(f); if (!m) return;
      const idx = k => (k === 0 ? f.a : f.b);
      [0, 1].forEach(j => {
        const inn = m.innings[j]; if (!inn || !inn.events.length) return;
        const s = st(m, j), balls = s.allOut ? inn.overs * 6 : s.legal;
        const bat = rows[idx(inn.bat)], bowl = rows[idx(1 - inn.bat)];
        bat.rf += s.runs; bat.bf += balls; bowl.ra += s.runs; bowl.ba += balls;
      });
      const A_ = rows[f.a], B_ = rows[f.b]; A_.p++; B_.p++;
      const w = m.result?.winner;
      if (w == null) { A_.tie++; B_.tie++; A_.pts++; B_.pts++; A_.form.push('T'); B_.form.push('T'); }
      else { const W = rows[idx(w)], L = W === A_ ? B_ : A_; W.w++; W.pts += 2; L.l++; W.form.push('W'); L.form.push('L'); }
    });
    rows.forEach(r => r.nrr = (r.bf ? r.rf * 6 / r.bf : 0) - (r.ba ? r.ra * 6 / r.ba : 0));
    return rows.sort((a, b) => b.pts - a.pts || b.nrr - a.nrr || b.w - a.w || a.name.localeCompare(b.name));
  }

  function stats(t) {
    const P = {}, g = id => (P[id] || (P[id] = { id, r: 0, b: 0, w: 0, br: 0, bb: 0, pts: 0, hs: 0 }));
    t.fixtures.forEach(f => {
      const m = fxMatch(f); if (!m) return;
      Object.entries(pomPoints(m)).forEach(([id, p]) => g(id).pts += p);
      m.innings.forEach((inn, i) => {
        if (i >= 2 || !inn.events.length) return;
        const s = st(m, i);
        Object.values(s.bat).forEach(b => { const p = g(b.id); p.r += b.r; p.b += b.b; p.hs = Math.max(p.hs, b.r); });
        Object.values(s.bowl).forEach(w => { const p = g(w.id); p.w += w.wkts; p.br += w.runs; p.bb += w.balls; });
      });
    });
    return Object.values(P);
  }

  function progress(t) {
    const league = t.fixtures.filter(f => f.stage === 'league');
    const leagueDone = league.every(f => fxMatch(f));
    if (leagueDone && t.ko !== 'none' && !t.fixtures.some(f => f.stage !== 'league')) {
      const tb = table(t);
      if (t.ko === 'semis' && tb.length >= 4) {
        t.fixtures.push({ id: GS.uid(), stage: 'semi', label: 'Semi-final 1', a: tb[0].i, b: tb[3].i, seedA: 0, seedB: 3 });
        t.fixtures.push({ id: GS.uid(), stage: 'semi', label: 'Semi-final 2', a: tb[1].i, b: tb[2].i, seedA: 1, seedB: 2 });
      } else if (tb.length >= 2) t.fixtures.push({ id: GS.uid(), stage: 'final', label: 'Final', a: tb[0].i, b: tb[1].i, seedA: 0, seedB: 1 });
    }
    const semis = t.fixtures.filter(f => f.stage === 'semi');
    if (semis.length === 2 && semis.every(f => fxMatch(f)) && !t.fixtures.some(f => f.stage === 'final')) {
      const tb = table(t), seed = i => tb.findIndex(r => r.i === i);
      const a = fxWinner(t, semis[0]), b = fxWinner(t, semis[1]);
      t.fixtures.push({ id: GS.uid(), stage: 'final', label: 'Final', a, b, seedA: seed(a), seedB: seed(b) });
    }
    const fin = t.fixtures.find(f => f.stage === 'final');
    const finished = fin ? !!fxMatch(fin) : (t.ko === 'none' && leagueDone && league.length > 0);
    if (finished && !t.done) {
      t.done = true; t.doneAt = Date.now();
      t.champ = fin ? fxWinner(t, fin) : table(t)[0].i;
      const S = stats(t).filter(p => DB.players[p.id]).sort((a, b) => b.pts - a.pts);
      t.pos = S[0]?.id || null;
      return 'done';
    }
    return null;
  }
  function onMatchDone(m) {
    if (!m.tour) return null;
    const t = get(m.tour.id); if (!t) return null;
    const f = t.fixtures.find(x => x.id === m.tour.fx); if (f) f.mid = m.id;
    const r = progress(t); save();
    return r === 'done' ? `🏆 ${t.teams[t.champ].name} win ${t.name}!` : null;
  }

  V.tours = () => `${GS.header('Tournaments')}<main>
    <button type="button" class="btn primary block xl" data-act="go" data-v="tourNew">＋ New tournament</button>
    ${DB.tours.slice().reverse().map(t => {
      const played = t.fixtures.filter(fxMatch).length;
      return `<div class="card tap" data-act="tourOpen" data-id="${t.id}"><div class="row between"><b>${esc(t.name)}</b>${t.done ? '<span class="pill green">Completed</span>' : '<span class="pill">In progress</span>'}</div>
        <div class="muted small">${t.teams.length} teams · ${t.overs} overs · ${played}/${t.fixtures.length} matches played</div>
        ${t.done ? `<div class="result">👑 ${esc(t.teams[t.champ]?.name || '')}</div>${t.pos ? `<div class="small">🏆 Player of the Series: <b>${esc(nm(t.pos))}</b></div>` : ''}` : ''}</div>`;
    }).join('') || '<p class="muted center">No tournaments yet.</p>'}</main>`;

  V.tourNew = () => {
    const r = Object.assign({}, GS.DEFAULT_RULES, GS.lastRules());
    return `${GS.header('New tournament')}<main>
    <div class="card"><label>Tournament name</label><input id="tnName" value="Gully Premier League ${new Date().getFullYear()}" maxlength="40">
      <div class="grid2"><div><label>Overs per innings</label><input id="tnOvers" type="number" min="1" max="50" value="${r.overs}"></div>
      <div><label>League format</label><select id="tnRR"><option value="1">Each team plays once</option><option value="2">Home & away (twice)</option></select></div></div>
      <label>Knockouts</label><select id="tnKO"><option value="semis">Top 4 → Semi-finals → Final</option><option value="final">Top 2 → Final</option><option value="none">No knockouts (table topper wins)</option></select></div>
    <div class="card"><h4>Teams (pick 3 or more)</h4>
      ${DB.teams.map((t, i) => `<label class="chk"><input type="checkbox" class="tnT" value="${i}"> ${esc(t.name)} <span class="muted small">(${t.players.length})</span></label>`).join('') || '<p class="muted small">No saved teams yet – add them below.</p>'}
      <details id="dTn" class="mt"><summary>＋ Add a new team</summary>
        <label>Team name</label><input id="tnNewName" maxlength="24">
        <label>Players (one per line)</label><textarea id="tnNewPl" rows="4"></textarea>
        <button type="button" class="btn block" data-act="tourAddTeam">Save team</button></details></div>
    <p class="muted small">Gully rules (wides, no-balls, last man standing…) are taken from your last match and can be changed before each game.</p>
    <button type="button" class="btn primary block xl" data-act="tourCreate">Create fixtures ▶</button></main>`;
  };

  V.tour = () => {
    const t = get(ui.tourId); if (!t) { ui.view = 'tours'; return V.tours(); }
    const tab = ui.tourTab;
    const tabs = [['fx', 'Fixtures'], ['tbl', 'Table'], ['st', 'Stats']].map(([k, l]) => `<button type="button" class="tab ${tab === k ? 'sel' : ''}" data-act="tourTab" data-k="${k}">${l}</button>`).join('');
    let body = '';
    if (tab === 'fx') {
      const groups = [['league', 'League'], ['semi', 'Semi-finals'], ['final', 'Final']];
      body = groups.map(([g, label]) => {
        const fs = t.fixtures.filter(f => f.stage === g); if (!fs.length) return '';
        return `<h3>${label}</h3>` + fs.map((f, k) => {
          const m = fxMatch(f), lv = liveMatch(f);
          const line = m ? `<div class="result small">${esc(m.result?.text || '')}</div>` : lv ? '<span class="pill red">LIVE</span>' : '';
          const act = m ? `<button type="button" class="btn sm" data-act="card" data-id="${m.id}">Scorecard</button>` : lv ? `<button type="button" class="btn sm primary" data-act="tourResume" data-id="${lv.id}">Resume</button>` : (t.done ? '' : `<button type="button" class="btn sm primary" data-act="tourPlay" data-id="${f.id}">Play ▶</button>`);
          return `<div class="card fx"><div class="row between"><div class="grow"><div class="muted tiny">${esc(f.label || 'Match ' + (k + 1))}</div><b>${esc(t.teams[f.a].name)}</b> <span class="muted">vs</span> <b>${esc(t.teams[f.b].name)}</b>${line}</div>${act}</div></div>`;
        }).join('');
      }).join('');
      if (t.ko !== 'none' && !t.fixtures.some(f => f.stage !== 'league')) body += `<p class="muted small center">Knockout fixtures appear automatically when the league is finished.</p>`;
    } else if (tab === 'tbl') {
      const tb = table(t), q = t.ko === 'semis' ? 4 : t.ko === 'final' ? 2 : 1;
      body = `<div class="card tight"><table class="t full tt"><tr><th>#</th><th>Team</th><th>P</th><th>W</th><th>L</th><th>T</th><th>Pts</th><th>NRR</th></tr>
        ${tb.map((r, k) => `<tr class="${k < q ? 'q' : ''}"><td>${k + 1}</td><td>${esc(r.name)}<div class="form sm">${r.form.slice(-5).map(x => `<span class="fr${x}">${x}</span>`).join('')}</div></td><td>${r.p}</td><td>${r.w}</td><td>${r.l}</td><td>${r.tie}</td><td><b>${r.pts}</b></td><td>${(r.nrr >= 0 ? '+' : '') + r.nrr.toFixed(3)}</td></tr>`).join('')}</table>
        <p class="muted tiny">Win 2 pts, tie 1. NRR = run rate scored − run rate conceded (all out counts as full overs). ${q > 1 ? `Top ${q} (highlighted) qualify.` : ''}</p></div>
        <button type="button" class="btn block" data-act="tourShare">📤 Share table</button>`;
    } else {
      const S = stats(t).filter(p => DB.players[p.id]);
      const top = (arr, f, n = 5) => arr.slice().sort(f).slice(0, n);
      const runs = top(S.filter(p => p.b), (a, b) => b.r - a.r), wk = top(S.filter(p => p.bb), (a, b) => b.w - a.w || a.br - b.br), mvp = top(S, (a, b) => b.pts - a.pts);
      body = `${t.done ? `<div class="card hero center"><div class="big">👑 ${esc(t.teams[t.champ].name)}</div><div>Champions of ${esc(t.name)}</div>${t.pos ? `<div class="mt">🏆 Player of the Series: <b>${esc(nm(t.pos))}</b></div>` : ''}</div>` : ''}
        <div class="card"><h4>🏏 Most runs</h4>${runs.map(p => `<div class="row between tap" data-act="player" data-id="${p.id}"><span>${esc(nm(p.id))}</span><b>${p.r} <small class="muted">(${p.b}) · HS ${p.hs}</small></b></div>`).join('') || '<p class="muted small">–</p>'}</div>
        <div class="card"><h4>🎯 Most wickets</h4>${wk.map(p => `<div class="row between tap" data-act="player" data-id="${p.id}"><span>${esc(nm(p.id))}</span><b>${p.w} <small class="muted">· econ ${GS.econ(p.br, p.bb)}</small></b></div>`).join('') || '<p class="muted small">–</p>'}</div>
        <div class="card"><h4>⭐ Player of the Series race</h4>${mvp.map(p => `<div class="row between tap" data-act="player" data-id="${p.id}"><span>${esc(nm(p.id))}</span><b>${p.pts} pts</b></div>`).join('') || '<p class="muted small">–</p>'}
        <p class="muted tiny">Same points as Player of the Match, added up across the tournament.</p></div>`;
    }
    return `${GS.header(t.name)}<main><div class="tabs">${tabs}</div>${body}
      <button type="button" class="btn danger block mt" data-act="tourDel" data-id="${t.id}">Delete tournament</button></main>`;
  };

  Object.assign(A, {
    tourOpen: d => { ui.tourId = d.id; ui.tourTab = 'fx'; ui.view = 'tour'; window.scrollTo(0, 0); GS.render(); },
    tourTab: d => { ui.tourTab = d.k; GS.render(); },
    tourAddTeam: () => {
      const name = document.getElementById('tnNewName').value.trim(), pl = document.getElementById('tnNewPl').value.split('\n').map(x => x.trim()).filter(Boolean);
      if (!name || pl.length < 2) return GS.toast('Give the team a name and at least 2 players');
      if (DB.teams.some(x => x.name.toLowerCase() === name.toLowerCase())) return GS.toast('A team with that name already exists');
      DB.teams.push({ name, players: [...new Set(pl.map(playerByName))] }); save(); GS.toast('Team saved');
    },
    tourCreate: () => {
      const idx = [...document.querySelectorAll('.tnT:checked')].map(x => +x.value);
      if (idx.length < 3) return GS.toast('Pick at least 3 teams');
      const ko = document.getElementById('tnKO').value;
      if (ko === 'semis' && idx.length < 4) return GS.toast('Semi-finals need at least 4 teams – choose “Top 2 → Final”');
      const teams = idx.map(i => ({ name: DB.teams[i].name, players: [...DB.teams[i].players] }));
      const overs = Math.max(1, +document.getElementById('tnOvers').value || 6), rr = +document.getElementById('tnRR').value;
      const t = { id: GS.uid(), name: document.getElementById('tnName').value.trim() || 'Tournament', created: Date.now(), overs, rr, ko, teams, rules: Object.assign({}, GS.DEFAULT_RULES, GS.lastRules(), { overs }), fixtures: [] };
      t.fixtures = roundRobin(teams.length, rr).map(([a, b], k) => ({ id: GS.uid(), stage: 'league', label: 'Match ' + (k + 1), a, b }));
      DB.tours.push(t); save();
      ui.tourId = t.id; ui.tourTab = 'fx'; ui.view = 'tour'; GS.render();
    },
    tourPlay: d => {
      const t = get(ui.tourId), f = t.fixtures.find(x => x.id === d.id);
      const A_ = t.teams[f.a], B_ = t.teams[f.b];
      ui.prefill = { tA: A_.name, tB: B_.name, pA: A_.players.map(nm).join('\n'), pB: B_.players.map(nm).join('\n'), rules: { ...t.rules, overs: t.overs }, career: true, tour: { id: t.id, fx: f.id }, tourName: t.name + ' · ' + (f.label || '') };
      ui.view = 'setup'; GS.render();
    },
    tourResume: d => { DB.current = d.id; save(); ui.view = 'score'; GS.render(); },
    tourShare: async () => {
      const t = get(ui.tourId), tb = table(t);
      const txt = `🏆 ${t.name} – points table\n\n` + tb.map((r, k) => `${k + 1}. ${r.name}  P${r.p} W${r.w} L${r.l} T${r.tie}  ${r.pts} pts  NRR ${(r.nrr >= 0 ? '+' : '') + r.nrr.toFixed(3)}`).join('\n');
      try { if (navigator.share) await navigator.share({ title: t.name, text: txt }); else { await navigator.clipboard.writeText(txt); GS.toast('Table copied'); } } catch { }
    },
    tourDel: d => { if (!confirm('Delete this tournament? Its matches stay in your match list.')) return; DB.tours = DB.tours.filter(x => x.id !== d.id); save(); ui.view = 'tours'; GS.render(); },
  });

  return { table, stats, progress, onMatchDone, roundRobin, get };
})();

