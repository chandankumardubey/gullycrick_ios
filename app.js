/* Gully Scorer – UI: screens, sheets, actions, boot */
'use strict';
(() => {
  const { DB, ui, esc, save, nm, short, playerByName, getMatch, cur, roster, st, lastIdx, isSuper, f1, sr, econ, computeResult, pom, ACH, V, S, A } = GS;
  const DEFAULT_RULES = GS.DEFAULT_RULES;
  const app = document.getElementById('app');
  const resetSel = () => { ui.sel = { runs: null, ex: null, w: false }; };
  let toastTimer;
  function toast(t) { ui.toast = t; render(); clearTimeout(toastTimer); toastTimer = setTimeout(() => { ui.toast = ''; render(); }, 2600); }
  GS.toast = toast;
  GS.lastRules = () => { const m = DB.matches.slice().reverse().find(x => x.rules); const r = m ? { ...m.rules } : {}; delete r.common; return r; };

  function header(title, back = true, menu = false) {
    return `<header>${back ? '<button type="button" class="icon" data-act="back" aria-label="Back">←</button>' : '<span class="logo" aria-hidden="true">🏏</span>'}<h1>${esc(title)}</h1>${menu ? '<button type="button" class="icon" data-act="menu" aria-label="Match menu">⋮</button>' : '<span class="hsp"></span>'}</header>`;
  }
  GS.header = header;
  function chip(l) {
    const c = /(^|\+)W$/.test(l) ? 'w' : l === '4' || l === '6' ? 'b' + l : /Wd|Nb|B|Lb/.test(l) ? 'x' : l === '0' ? 'z' : '';
    return `<span class="chip ${c}">${l === '0' ? '•' : esc(l)}</span>`;
  }
  const ini = n => esc(String(n).split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase());

  // ================= HOME =================
  V.home = () => {
    const m = cur();
    let live = '';
    if (m && m.status === 'live') {
      const i = lastIdx(m), s = m.innings[i].events.length ? st(m, i) : null;
      live = `<div class="card live tap" data-act="resume">
        <div class="row between"><span class="pill red">● ${m.live ? 'LIVE · sharing' : 'IN PROGRESS'}</span><span class="muted small">${esc(m.teams[0].name)} vs ${esc(m.teams[1].name)}</span></div>
        ${s ? `<div class="big">${esc(m.teams[m.innings[i].bat].name)} ${s.runs}/${s.wkts} <small>(${s.oversStr})</small></div>` : '<div class="big">Ready to start</div>'}
        <button type="button" class="btn primary block" data-act="resume">Resume scoring</button></div>`;
    }
    const handed = DB.matches.filter(x => x.status === 'handed' && Date.now() - (x.handedAt || 0) < 2 * 864e5).map(x => `<div class="card"><div class="row between"><span class="pill">📲 Handed over</span><span class="muted small">${esc(x.teams[0].name)} vs ${esc(x.teams[1].name)}</span></div>
      <p class="small">Another phone is scoring this match.</p><div class="grid2"><button type="button" class="btn" data-act="takeBack" data-id="${x.id}">Take back scoring</button>${x.live ? `<button type="button" class="btn" data-act="watchLive" data-id="${x.id}">Watch live</button>` : `<button type="button" class="btn" data-act="card" data-id="${x.id}">Scorecard</button>`}</div></div>`).join('');
    const done = DB.matches.filter(x => x.status === 'done').slice().reverse();
    const last = done[0];
    const sk = GS.streak();
    const streakTxt = sk.n ? `<span class="pill fire">🔥 ${sk.n}-week streak</span>` : '';
    const lastCard = last ? `<div class="card hero">
      <div class="row between"><span class="muted small">Last match, ${new Date(last.created).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>${streakTxt}</div>
      ${last.innings.slice(0, 2).map((inn, i) => { const s = st(last, i); return `<div class="row between tline"><span><span class="av">${ini(last.teams[inn.bat].name)}</span> ${esc(last.teams[inn.bat].name)}</span><b>${s.runs}/${s.wkts}</b></div>`; }).join('')}
      <div class="result">${esc(last.result?.text || '')}</div>
      ${last.pom ? `<div class="small">🏅 <b>${esc(nm(last.pom))}</b> Player of the Match</div>` : ''}
      <div class="row gap wrap mt"><button type="button" class="btn sm" data-act="card" data-id="${last.id}">Scorecard</button><button type="button" class="btn sm" data-act="shareMenu" data-id="${last.id}">📤 Share</button><button type="button" class="btn sm" data-act="rematch" data-id="${last.id}">🔁 Rematch</button></div>
      ${!sk.thisWeek && sk.n ? `<div class="tip">Score a match by Sunday to make it ${sk.n + 1} weeks.</div>` : ''}</div>` : '';

    let mine = '';
    const me = DB.settings.me && DB.players[DB.settings.me] ? DB.settings.me : '';
    if (me) {
      const p = GS.career()[me];
      if (p) {
        const last5 = p.perMatch.slice(-5);
        mine = `<div class="card tap" data-act="player" data-id="${me}"><div class="row between"><h4>Your stats · ${esc(nm(me))}</h4><span class="muted">›</span></div>
          <div class="muted small">${p.m.size} matches</div>
          <div class="stats4"><div><b>${p.r}</b><span>runs</span></div><div><b>${p.inn - p.no ? (p.r / (p.inn - p.no)).toFixed(1) : '-'}</b><span>avg</span></div><div><b>${sr(p.r, p.b)}</b><span>SR</span></div>
          <div><b>${p.w}</b><span>wkts</span></div><div><b>${econ(p.br, p.bb)}</b><span>econ</span></div><div><b>${p.best[0] ? p.best[0] + '/' + p.best[1] : '-'}</b><span>best</span></div></div>
          <div class="muted tiny">Last ${last5.length} matches, oldest first</div>
          <div class="l5">${last5.map(x => `<div><b>${x.r ?? '–'}</b><span>${x.w != null ? x.w + '/' + x.wr : '–'}</span></div>`).join('')}</div></div>`;
      }
    } else if (Object.keys(DB.players).length) {
      mine = `<div class="card"><label for="meSel">Which player are you? (for “Your stats”)</label><select id="meSel" data-chg="setMe"><option value="">Choose…</option>${GS.pool().sort((a, b) => a.name.localeCompare(b.name)).map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('')}</select></div>`;
    }

    const ins = [];
    const liveTour = DB.tours.filter(t => !t.done).slice(-1)[0];
    if (liveTour) { const tb = Tour.table(liveTour); ins.push(`<div class="ins tap" data-act="tourOpen" data-id="${liveTour.id}"><span class="pill">Tournament</span><div><b>${esc(liveTour.name)}</b></div><div class="muted small">Leaders: ${tb.slice(0, 3).map(r => `${esc(r.name)} ${r.pts}`).join(' · ')}</div></div>`); }
    const rv = GS.topRivalry();
    if (rv) {
      const other = GS.batVsOthers(rv.bat, rv.bowl);
      ins.push(`<div class="ins tap" data-act="player" data-id="${rv.bowl}"><span class="pill">Rivalry</span><div><b>${esc(nm(rv.bowl))}</b> has dismissed <b>${esc(nm(rv.bat))}</b> ${rv.outs} times in ${rv.ms.size} meeting${rv.ms.size > 1 ? 's' : ''}.</div><div class="muted small">${esc(nm(rv.bat))} strikes at ${sr(rv.runs, rv.balls)} against them and ${sr(other.r, other.b)} against everyone else.</div></div>`);
    }
    const ms = GS.milestones()[0];
    if (ms) ins.push(`<div class="ins tap" data-act="player" data-id="${ms.id}"><span class="pill">Milestone</span><div><b>${esc(nm(ms.id))}</b> · ${esc(ms.text)}</div><div class="muted small">${esc(ms.sub)}</div></div>`);
    const forms = DB.teams.map(t => ({ t, f: GS.teamForm(t.name) })).filter(x => x.f.length >= 2).sort((a, b) => b.f.filter(r => r === 'W').length - a.f.filter(r => r === 'W').length)[0];
    if (forms) ins.push(`<div class="ins"><span class="pill">Teams</span><div><b>${esc(forms.t.name)}</b> · ${forms.f.filter(r => r === 'W').length} wins in their last ${forms.f.length}</div><div class="form">${forms.f.map(r => `<span class="fr${r}">${r}</span>`).join('')}</div></div>`);
    const ach = GS.careerAll().ach.filter(a => DB.players[a.id] && a.key !== 'pom').slice(-3).reverse();
    if (ach.length) ins.push(`<div class="ins tap" data-act="go" data-v="stats" data-tab="awards"><span class="pill">Achievements</span>${ach.map(a => `<div>${ACH[a.key].icon} <b>${esc(nm(a.id))}</b> · ${esc(ACH[a.key].name)}${a.extra && !['maiden', 'pos', 'champ'].includes(a.key) ? ` (${a.extra})` : ''}</div>`).join('')}</div>`);

    const tips = ['Same player, two names? Open a player in Stats and merge duplicates so their careers join up.', 'Use Team maker to split everyone into two balanced sides in one tap.', 'Turn on the mic while scoring and just say “four”, “wide plus one” or “bowled”.', 'Show the live QR code at the ground so everyone can follow the score.', 'Battery low? Match menu → Hand over, and a friend continues scoring on their phone.', 'Send a “Who’s in?” poll and make teams straight from the players who said In.', 'Commentary studio: mix Hindi and English, male and female voices, and the funny Paaji style.'];
    const tip = tips[new Date().getDate() % tips.length];

    return `${header('Gully Scorer', false)}
      <main>${live}${handed}
        <button type="button" class="btn primary block xl" data-act="newMatch">＋ New match</button>
        <div class="grid3"><button type="button" class="btn tile" data-act="go" data-v="teams"><span>🎲</span>Team maker</button><button type="button" class="btn tile" data-act="go" data-v="tours"><span>🏆</span>Tournament</button><button type="button" class="btn tile" data-act="go" data-v="polls"><span>🙋</span>Who's in?</button></div>
        <button type="button" class="btn block" data-act="studio">🎙 Commentary studio</button>
        ${DB.soloCur && DB.solos.find(x => x.id === DB.soloCur) ? '<button type="button" class="btn primary block" data-act="soloResume" data-id="' + DB.soloCur + '">▶ Resume solo battle</button>' : ''}
        <button type="button" class="btn block" data-act="go" data-v="solo">🧍 Solo battle – no teams needed</button>
        ${lastCard}${mine}
        ${ins.length ? `<h3>From your matches</h3>${ins.join('')}` : ''}
        <div class="tipbox">💡 <b>Tip of the day</b><br>${esc(tip)}</div>
      </main>${tabbar('home')}`;
  };
  function tabbar(active) {
    const t = (v, i, l) => `<button type="button" class="${active === v ? 'on' : ''}" data-act="go" data-v="${v}"><span aria-hidden="true">${i}</span>${l}</button>`;
    return `<nav class="tabbar">${t('home', '🏠', 'Home')}${t('matches', '📋', 'Matches')}${t('stats', '📊', 'Stats')}${t('settings', '⚙️', 'Settings')}</nav>`;
  }

  V.matches = () => {
    const all = DB.matches.slice().reverse();
    return `${header('Matches', false)}<main>${all.map(x => {
      const lines = x.innings.slice(0, 2).map((inn, i) => { const s = inn.events.length ? st(x, i) : null; return `<div class="row between"><span>${esc(x.teams[inn.bat].name)}</span><b>${s ? `${s.runs}/${s.wkts} <small>(${s.oversStr})</small>` : '–'}</b></div>`; }).join('');
      const badge = (x.audit && x.audit.some(a => a.kind === 'adj' && !['undone', 'reverted'].includes(a.status)) ? '<span class="pill yellow">✎ adjusted</span> ' : '') + (x.status === 'live' ? '<span class="pill red">LIVE</span>' : x.status === 'handed' ? '<span class="pill">Handed over</span>' : '');
      return `<div class="card tap" data-act="${x.status === 'live' && x.id === DB.current ? 'resume' : 'card'}" data-id="${x.id}"><div class="row between muted small"><span>${new Date(x.created).toLocaleString()}${x.tourName ? ' · ' + esc(x.tourName) : ''}</span>${badge}</div>${lines}<div class="result">${esc(x.result?.text || '')}</div>${x.pom ? `<div class="small">🏅 ${esc(nm(x.pom))}</div>` : ''}</div>`;
    }).join('') || '<p class="muted center">No matches yet.</p>'}</main>${tabbar('matches')}`;
  };

  // ================= SETUP =================
  V.setup = () => {
    const p = ui.prefill || {};
    const r = Object.assign({}, DEFAULT_RULES, GS.lastRules(), p.rules || {});
    const nA = p.tA || 'Colony Kings', nB = p.tB || 'Rooftop Rebels', cn = ui.coin || {};
    const teamOpts = DB.teams.map((t, i) => `<option value="${i}">${esc(t.name)}</option>`).join('');
    const teamBlock = (k, label, def) => `<div class="card">
      <label for="t${k}">${label}</label><input id="t${k}" value="${esc(p['t' + k] || def)}" maxlength="24">
      ${DB.teams.length && !p.tour ? `<select data-load="${k}" aria-label="Load saved team"><option value="">Load saved team…</option>${teamOpts}</select>` : ''}
      <label for="p${k}">Players <span class="muted small">(optional – one per line. Leave blank to start with just the team name; add / edit players anytime during the match)</span></label>
      <textarea id="p${k}" rows="4" placeholder="Rohit&#10;Vikram&#10;Ankit">${esc(p['p' + k] || '')}</textarea>
      <label for="n${k}">Number of players (used when names are blank)</label><input id="n${k}" type="number" min="2" max="15" value="${p['n' + k] || 6}"></div>`;
    const chk = (id, label, v) => `<label class="chk"><input type="checkbox" id="${id}" ${v ? 'checked' : ''}> ${label}</label>`;
    return `${header('New match')}
      <main>${p.tour ? `<div class="card hero"><span class="pill">🏆 Tournament match</span><div><b>${esc(p.tourName)}</b></div></div>` : '<button type="button" class="btn block" data-act="go" data-v="teams">🎲 Make balanced teams with Team maker</button>'}
      ${teamBlock('A', 'Team A', 'Colony Kings')}${teamBlock('B', 'Team B', 'Rooftop Rebels')}
      <div class="card"><label for="overs">Overs per innings</label><input id="overs" type="number" min="1" max="50" value="${r.overs}">
      </div>
      <div class="card" id="tossCard"><h4>🪙 Toss</h4>
        <div class="grid2"><div><label for="caller">Who calls?</label><select id="caller"><option value="0" ${cn.winner === undefined || cn.caller === 0 ? 'selected' : ''}>${esc(nA)}</option><option value="1" ${cn.caller === 1 ? 'selected' : ''}>${esc(nB)}</option></select></div>
          <div><label for="call">Call</label><select id="call"><option value="heads" ${cn.call !== 'tails' ? 'selected' : ''}>Heads</option><option value="tails" ${cn.call === 'tails' ? 'selected' : ''}>Tails</option></select></div></div>
        <div class="coinwrap" id="coinWrap"><div class="coin" id="coin" style="transform:rotateY(${ui.coinRot || 0}deg)" role="img" aria-label="Coin"><div class="face h">H</div><div class="face t">T</div></div></div>
        <div class="tossmsg" id="tossMsg" aria-live="polite">${cn.winner !== undefined ? tossText(cn, nA, nB) : ''}</div>
        <button type="button" class="btn primary block" id="flipBtn" data-act="flipCoin">🪙 ${cn.winner !== undefined ? 'Flip again' : 'Flip the coin'}</button>
        <p class="muted small">Or pick the winner yourself:</p>
        <label for="toss">Toss won by</label><select id="toss" data-chg="tossManual"><option value="0" ${cn.winner !== 1 ? 'selected' : ''}>${esc(nA)}</option><option value="1" ${cn.winner === 1 ? 'selected' : ''}>${esc(nB)}</option></select>
        <label for="dec">Elected to</label><select id="dec"><option value="bat">Bat</option><option value="bowl">Bowl</option></select></div>
      <details id="dRules" class="card" ${p.rules?.common ? 'open' : ''}><summary>Gully rules</summary>
        <div class="grid2"><div><label for="wideRuns">Wide runs</label><input id="wideRuns" type="number" min="0" max="5" value="${r.wideRuns}"></div>
        <div><label for="nbRuns">No-ball runs</label><input id="nbRuns" type="number" min="0" max="5" value="${r.nbRuns}"></div></div>
        <label for="maxBowlerOvers">Max overs per bowler (0 = no limit)</label><input id="maxBowlerOvers" type="number" min="0" max="20" value="${r.maxBowlerOvers}">
        ${chk('wideLegal', 'Wide counts as a legal ball (no re-bowl)', r.wideLegal)}
        ${chk('nbLegal', 'No-ball counts as a legal ball (no re-bowl)', r.nbLegal)}
        ${chk('freeHit', 'Free hit after no-ball', r.freeHit)}
        ${chk('lms', 'Last man standing (last batter bats alone)', r.lms)}
        ${chk('consecutive', 'Allow same bowler consecutive overs', r.consecutive)}
        ${chk('oneTip', 'One tip one hand catch is out', r.oneTip)}
        ${chk('hitOutside', 'Hitting outside / over the wall is out', r.hitOutside)}
        ${chk('common', 'Common player (one player may play for both teams)', r.common)}
      </details>
      <div class="card">${chk('career', 'Count this match in career stats', p.career ?? true)}</div>
      <button type="button" class="btn primary block xl" data-act="startMatch">Start match ▶</button></main>`;
  };

  // ================= SCORING =================
  function scoreHeader(m, i, s) {
    const inn = m.innings[i], t = m.teams[inn.bat];
    const tag = isSuper(m, i) ? 'Super Over' : (i === 0 ? '1st innings' : '2nd innings');
    let chase = '';
    if (inn.target) chase = s.done ? '' : `<div class="chase">Need <b>${s.need}</b> off <b>${s.ballsLeft}</b> · RRR ${f1(s.rrr)}</div>`;
    return `<section class="scorebox" aria-live="polite">
      <div class="row between small"><span>${esc(t.name)} · ${tag}</span><span>CRR ${f1(s.crr)}${inn.target ? ' · Target ' + inn.target : ''}</span></div>
      <div class="score">${s.runs}<span>/${s.wkts}</span> <small>(${s.oversStr}/${inn.overs})</small></div>${chase}
      ${s.freeHit ? '<div class="pill yellow">FREE HIT</div>' : ''}${s.solo ? '<div class="pill yellow">LAST MAN STANDING</div>' : ''}
      ${m.live && !ui.readonly ? `<div class="pill red">● LIVE${ui.liveState ? ' · ' + esc(ui.liveState) : ''}</div>` : ''}
    </section>`;
  }
  function crease(s) {
    const row = (id, star) => { if (!id) return ''; const b = s.bat[id]; return `<tr class="${star ? 'on' : ''}"><td>${esc(short(id))}${star ? ' *' : ''}</td><td><b>${b.r}</b></td><td>${b.b}</td><td>${b.f4}</td><td>${b.f6}</td><td>${sr(b.r, b.b)}</td></tr>`; };
    const w = s.bowler ? s.bowl[s.bowler] : null;
    const c = s.overs[s.overs.length - 1];
    const chips = (c.length ? c : (s.overs.length > 1 ? s.overs[s.overs.length - 2] : [])).map(chip).join('');
    return `<section class="card tight">
      <table class="t"><tr><th>Batter</th><th>R</th><th>B</th><th>4s</th><th>6s</th><th>SR</th></tr>${row(s.striker, true)}${row(s.non, false)}</table>
      <div class="muted small">Partnership ${s.part.runs} (${s.part.balls})</div>
      ${w ? `<table class="t"><tr><th>Bowler</th><th>O</th><th>M</th><th>R</th><th>W</th><th>Eco</th></tr><tr><td>${esc(short(w.id))}</td><td>${Engine.ovs(w.balls)}</td><td>${w.maidens}</td><td>${w.runs}</td><td><b>${w.wkts}</b></td><td>${econ(w.runs, w.balls)}</td></tr></table>` : ''}
      <div class="over"><span class="muted small">${c.length ? 'This over' : 'Last over'}</span>${chips || '<span class="muted small">–</span>'}</div></section>`;
  }
  V.score = () => {
    const m = cur(); if (!m) { ui.view = 'home'; return V.home(); }
    const i = lastIdx(m), inn = m.innings[i];
    if (!inn.events.length) { if (!ui.sheet) ui.sheet = { type: 'openers' }; return `${header('Scoring', true, true)}<main><div class="card"><div class="big">${esc(m.teams[inn.bat].name)} to bat</div>${inn.target ? `<p>Target <b>${inn.target}</b> in ${inn.overs} over(s)</p>` : ''}<button type="button" class="btn" data-act="undo">↶ Undo</button></div></main>`; }
    const s = st(m, i);
    if (s.done) return `${header('Scoring', true, true)}<main>${scoreHeader(m, i, s)}${breakPanel(m, i, s)}</main>`;
    if (!ui.sheet) { if (s.needBatter) ui.sheet = { type: 'batter' }; else if (s.needBowler) ui.sheet = { type: 'bowler' }; }
    const sel = ui.sel, ex = sel.ex;
    const runBtn = n => `<button type="button" class="run ${sel.runs === n ? 'sel' : ''} ${n === 4 ? 'four' : n === 6 ? 'six' : ''}" data-act="run" data-n="${n}">${n}</button>`;
    const exBtn = (k, l) => `<button type="button" class="tog ${ex === k ? 'sel' : ''}" data-act="ex" data-k="${k}" aria-pressed="${ex === k}">${l}</button>`;
    const ready = sel.runs !== null || ex || sel.w;
    const comm = ui.lastLine || GS.lastCommentary(m);
    return `${header('Scoring', true, true)}<main class="scoring">${scoreHeader(m, i, s)}${crease(s)}${auditNote(m)}
      ${comm ? `<div class="comm1" aria-live="polite">${DB.settings.speak ? '🔊' : '🎙'} ${esc(comm)}</div>` : ''}
      <section class="pad">
        ${X.voiceUI()}
        <div class="toggles">${exBtn('wd', 'Wide')}${exBtn('nb', 'No ball')}${exBtn('b', 'Bye')}${exBtn('lb', 'Leg bye')}
          <button type="button" class="tog wk ${sel.w ? 'sel' : ''}" data-act="wk" aria-pressed="${sel.w}">Wicket</button></div>
        <div class="runs">${[0, 1, 2, 3, 4, 5, 6].map(runBtn).join('')}<button type="button" class="run alt" data-act="swap" aria-label="Swap strike">⇄</button></div>
        <div class="row gap"><button type="button" class="btn" data-act="undo">↶ Undo</button>
          <button type="button" class="btn mic ${ui.voice.on ? 'on' : ''}" data-act="voiceToggle" aria-label="${ui.voice.on ? 'Stop voice scoring' : 'Start voice scoring'}" aria-pressed="${ui.voice.on}">🎤</button>
          <button type="button" class="btn primary grow" data-act="next" ${ready ? '' : 'disabled'}>Next Ball ${preview()}</button></div>
      </section></main>`;
  };
  function preview() {
    const { runs, ex, w } = ui.sel; if (runs === null && !ex && !w) return '';
    const r = runs ?? 0; const lab = ex === 'wd' ? 'Wd' + (r ? '+' + r : '') : ex === 'nb' ? 'Nb' + (r ? '+' + r : '') : ex ? r + (ex === 'b' ? 'B' : 'Lb') : String(r);
    return `· ${esc(lab)}${w ? '+W' : ''}`;
  }
  function breakPanel(m, i, s) {
    const inn = m.innings[i];
    if (i % 2 === 0) {
      return `<div class="card"><div class="big">Innings complete</div>${auditNote(m)}
        <p>${esc(m.teams[inn.bat].name)} ${s.runs}/${s.wkts} (${s.oversStr}). ${esc(m.teams[1 - inn.bat].name)} need <b>${s.runs + 1}</b> to win.</p>
        <button type="button" class="btn primary block" data-act="nextInnings">Start ${i === 0 ? '2nd innings' : 'Super Over chase'} ▶</button>
        <div class="row gap"><button type="button" class="btn" data-act="undo">↶ Undo last ball</button><button type="button" class="btn" data-act="card" data-id="${m.id}">Scorecard</button></div></div>`;
    }
    const r = computeResult(m);
    return `<div class="card"><div class="big">${esc(r.text)}</div>${auditNote(m)}
      ${r.tie ? '<button type="button" class="btn primary block" data-act="superOver">Play Super Over ⚡</button>' : ''}
      <button type="button" class="btn ${r.tie ? '' : 'primary'} block" data-act="finish">Finish match ✔</button>
      <div class="row gap"><button type="button" class="btn" data-act="undo">↶ Undo last ball</button><button type="button" class="btn" data-act="card" data-id="${m.id}">Scorecard</button></div></div>`;
  }

  // ================= SCORECARD =================
  function cardSections(m) {
    return m.innings.map((inn, i) => {
      if (!inn.events.length) return '';
      const s = st(m, i), bt = m.teams[inn.bat];
      const batRows = s.batOrder.map(id => { const b = s.bat[id]; return `<tr><td>${esc(nm(id))}<div class="muted tiny">${esc(b.out || 'not out')}</div></td><td><b>${b.r}</b></td><td>${b.b}</td><td>${b.f4}</td><td>${b.f6}</td><td>${sr(b.r, b.b)}</td></tr>`; }).join('');
      const ytb = roster(m, inn.bat).filter(id => !s.bat[id]).map(nm);
      const bowlRows = s.bowlOrder.map(id => { const w = s.bowl[id]; return `<tr><td>${esc(nm(id))}</td><td>${Engine.ovs(w.balls)}</td><td>${w.maidens}</td><td>${w.runs}</td><td><b>${w.wkts}</b></td><td>${econ(w.runs, w.balls)}</td></tr>`; }).join('');
      const overs = s.overs.filter(o => o.length).map((o, k) => `<div class="ovrow"><span class="muted small">Ov ${k + 1}</span>${o.map(chip).join('')}</div>`).join('');
      const shots = {}; s.ballsList.forEach(x => { if (x.wg && x.batRuns > 0) (shots[x.striker] || (shots[x.striker] = [])).push({ wg: x.wg, r: x.batRuns }); });
      const lhOf = id => !!(DB.players[id]?.lh || (ui.vlh && ui.vlh[id]));
      const wheels = Object.keys(shots).length ? `<details id="dWg${i}" class="sub"><summary>🎯 Wagon wheels</summary><div class="wgrid">${Object.entries(shots).map(([id, sh]) => `<div class="wcell">${X.wheel(sh, lhOf(id), 'small')}<div class="small center"><b>${esc(short(id))}</b> ${s.bat[id].r} (${s.bat[id].b})</div></div>`).join('')}</div></details>` : '';
      const comm = GS.commentary(m, i).slice().reverse();
      const commBox = `<details id="dCm${i}" class="sub"><summary>🎙 Commentary</summary><div class="comm">${comm.map(c => `<div class="cl ${c.kind}"><span class="co">${c.kind === 'o' ? '' : esc(c.over)}</span><span>${esc(c.text)}</span></div>`).join('')}</div></details>`;
      return `<details id="dIn${i}" class="card" ${i === m.innings.length - 1 || i === 0 ? 'open' : ''}><summary><b>${esc(bt.name)}</b> ${isSuper(m, i) ? '(Super Over)' : ''} <span class="fr">${s.runs}/${s.wkts} (${s.oversStr})</span></summary>
        <table class="t full"><tr><th>Batter</th><th>R</th><th>B</th><th>4s</th><th>6s</th><th>SR</th></tr>${batRows}</table>
        <div class="small">Extras <b>${s.extrasTotal}</b> (wd ${s.ext.wd}, nb ${s.ext.nb}, b ${s.ext.b}, lb ${s.ext.lb})</div>
        ${ytb.length ? `<div class="small muted">Yet to bat: ${esc(ytb.join(', '))}</div>` : ''}
        ${s.fow.length ? `<div class="small"><b>Fall of wickets:</b> ${s.fow.map(f => `${f.runs}-${f.wkt} (${esc(nm(f.id))}, ${f.over})`).join(', ')}</div>` : ''}
        <table class="t full"><tr><th>Bowler</th><th>O</th><th>M</th><th>R</th><th>W</th><th>Eco</th></tr>${bowlRows}</table>
        <div class="small"><b>Ball by ball</b></div>${overs}${wheels}${commBox}</details>`;
    }).join('') + auditSection(m);
  }
  function matchHead(m) {
    return `<div class="muted small">${new Date(m.created).toLocaleString()}${m.tourName ? ' · ' + esc(m.tourName) : ''}</div>
      <div class="big">${esc(m.teams[0].name)} vs ${esc(m.teams[1].name)}</div>
      <div class="small">${esc(m.teams[m.toss.winner].name)} won the toss${m.toss.coin ? ` (coin: ${m.toss.coin.result})` : ''} and chose to ${m.toss.dec}</div>${auditActive(m) ? `<div class="small"><span class="pill yellow">✎ includes ${auditActive(m)} manual adjustment${auditActive(m) > 1 ? 's' : ''}</span></div>` : ''}
      ${m.result ? `<div class="result">${esc(m.result.text)}</div>` : '<div class="pill red">In progress</div>'}
      ${m.pom ? `<div>🏅 Player of the Match: <b>${esc(nm(m.pom))}</b></div>` : ''}`;
  }
  V.card = () => {
    const m = getMatch(ui.cardId); if (!m) return V.home();
    const own = m.id === DB.current && m.status === 'live';
    return `${header('Scorecard')}
      <main><div class="card">${matchHead(m)}
        <div class="row gap wrap mt"><button type="button" class="btn" data-act="shareMenu" data-id="${m.id}">📤 Share</button>
        ${m.status === 'done' ? `<button type="button" class="btn" data-act="rematch" data-id="${m.id}">🔁 Rematch</button><button type="button" class="btn danger" data-act="delMatch" data-id="${m.id}" aria-label="Delete match">🗑</button>` : own ? `<button type="button" class="btn primary" data-act="resume">Back to scoring</button>` : ''}</div></div>
        ${cardSections(m)}</main>`;
  };
  V.viewer = () => {
    const m = ui.vm;
    if (!m) return `${header('Gully Scorer', false)}<main><div class="card">${esc(ui.viewErr || 'Loading…')}</div><button type="button" class="btn block" data-act="exitViewer">Open my app</button></main>`;
    const i = m.innings.length - 1, inn = m.innings[i];
    const liveTop = m.status === 'live' && inn.events.length ? (() => { const s = st(m, i); return scoreHeader(m, i, s) + crease(s); })() : '';
    const comm = m.status === 'live' ? GS.commentary(m, i).slice(-6).reverse() : [];
    const age = ui.vLive ? Math.max(0, Math.round((Date.now() - (ui.vTs || Date.now())) / 1000)) : null;
    return `${header(ui.vLive ? 'Live score' : 'Shared scorecard', false)}<main>
      ${ui.vLive ? `<div class="pill ${m.status === 'live' ? 'red' : ''}">${m.status === 'live' ? '● LIVE' : 'Final'} · updated ${age}s ago · auto-refresh 5s</div>` : ''}
      ${liveTop}${comm.length ? `<div class="card"><h4>🎙 Commentary</h4><div class="comm">${comm.map(c => `<div class="cl ${c.kind}"><span class="co">${c.kind === 'o' ? '' : esc(c.over)}</span><span>${esc(c.text)}</span></div>`).join('')}</div></div>` : ''}
      <div class="card">${matchHead(m)}
      <div class="row gap wrap mt">${m.status === 'done' ? '<button type="button" class="btn primary" data-act="importShared">⬇ Save to my matches</button>' : ''}<button type="button" class="btn" data-act="viewImg">🖼 Image</button><button type="button" class="btn" data-act="exitViewer">Open my app</button></div></div>
      ${cardSections(m)}</main>`;
  };

  // ================= STATS =================
  V.stats = () => {
    const { P, ach } = GS.careerAll();
    const pl = Object.values(P).filter(p => DB.players[p.id]);
    const tab = ui.statsTab;
    const tabs = [['bat', 'Batting'], ['bowl', 'Bowling'], ['field', 'Fielding'], ['h2h', 'Rivalries'], ['awards', 'Awards']].map(([k, l]) => `<button type="button" class="tab ${tab === k ? 'sel' : ''}" data-act="stab" data-k="${k}">${l}</button>`).join('');
    let body = '';
    if (tab === 'bat') {
      body = `<table class="t full"><tr><th>Player</th><th>M</th><th>R</th><th>HS</th><th>Avg</th><th>SR</th><th>4/6</th></tr>` + pl.filter(p => p.inn).sort((a, b) => b.r - a.r).map(p => `<tr class="tap" data-act="player" data-id="${p.id}"><td>${esc(short(p.id))}</td><td>${p.m.size}</td><td><b>${p.r}</b></td><td>${p.hs}${p.hsNo ? '*' : ''}</td><td>${p.inn - p.no ? (p.r / (p.inn - p.no)).toFixed(1) : '-'}</td><td>${sr(p.r, p.b)}</td><td>${p.f4}/${p.f6}</td></tr>`).join('') + '</table>';
    } else if (tab === 'bowl') {
      body = `<table class="t full"><tr><th>Player</th><th>O</th><th>W</th><th>Best</th><th>Eco</th><th>Avg</th></tr>` + pl.filter(p => p.bb).sort((a, b) => b.w - a.w || a.br - b.br).map(p => `<tr class="tap" data-act="player" data-id="${p.id}"><td>${esc(short(p.id))}</td><td>${Engine.ovs(p.bb)}</td><td><b>${p.w}</b></td><td>${p.best[0] ? p.best[0] + '/' + p.best[1] : '-'}</td><td>${econ(p.br, p.bb)}</td><td>${p.w ? (p.br / p.w).toFixed(1) : '-'}</td></tr>`).join('') + '</table>';
    } else if (tab === 'field') {
      body = `<table class="t full"><tr><th>Player</th><th>Ct</th><th>RO</th><th>St</th></tr>` + pl.filter(p => p.ct + p.ro + p.st).sort((a, b) => (b.ct + b.ro + b.st) - (a.ct + a.ro + a.st)).map(p => `<tr class="tap" data-act="player" data-id="${p.id}"><td>${esc(short(p.id))}</td><td>${p.ct}</td><td>${p.ro}</td><td>${p.st}</td></tr>`).join('') + '</table>';
    } else if (tab === 'h2h') {
      const H = Object.values(GS.careerAll().H).filter(h => h.balls >= 3 && DB.players[h.bat] && DB.players[h.bowl]).sort((a, b) => b.outs - a.outs || b.balls - a.balls).slice(0, 40);
      body = `<table class="t full"><tr><th>Bowler v Batter</th><th>Balls</th><th>Runs</th><th>Outs</th><th>SR</th></tr>${H.map(h => `<tr class="tap" data-act="player" data-id="${h.bat}"><td>${esc(short(h.bowl))} <span class="muted">v</span> ${esc(short(h.bat))}</td><td>${h.balls}</td><td>${h.runs}</td><td><b>${h.outs}</b></td><td>${sr(h.runs, h.balls)}</td></tr>`).join('')}</table>`;
    } else {
      const counts = {};
      ach.filter(a => DB.players[a.id]).forEach(a => (counts[a.key] || (counts[a.key] = [])).push(a));
      body = Object.keys(ACH).filter(k => counts[k]).map(k => { const by = {}; counts[k].forEach(a => by[a.id] = (by[a.id] || 0) + 1); return `<div class="aw"><div class="awi" aria-hidden="true">${ACH[k].icon}</div><div class="grow"><b>${esc(ACH[k].name)}</b> <span class="tier t${ACH[k].tier}">${ACH[k].tier}</span><div class="muted small">${Object.entries(by).sort((a, b) => b[1] - a[1]).map(([id, n]) => `${esc(nm(id))}${n > 1 ? ' ×' + n : ''}`).join(', ')}</div></div></div>`; }).join('');
    }
    const empty = pl.length ? '' : '<p class="muted">Finish a match to see leaderboards.</p>';
    return `${header('Stats', false)}<main><div class="tabs scrollx">${tabs}</div><div class="card tight">${body || '<p class="muted small">Nothing here yet.</p>'}${empty}</div>
      <h3>Players</h3><div class="card"><div class="wrap row gap">${GS.everyone().sort((a, b) => a.name.localeCompare(b.name)).map(p => `<button type="button" class="pill tap" data-act="player" data-id="${p.id}">${esc(p.name)}</button>`).join('')}</div></div></main>${tabbar('stats')}`;
  };

  V.player = () => {
    const id = ui.playerId, { P, ach } = GS.careerAll(), p = P[id], pl = DB.players[id];
    if (!pl) { ui.view = 'stats'; return V.stats(); }
    const box = (l, v) => `<div class="stat"><b>${v}</b><span>${l}</span></div>`;
    const mine = ach.filter(a => a.id === id);
    const grouped = {}; mine.forEach(a => grouped[a.key] = (grouped[a.key] || 0) + 1);
    const awards = Object.keys(ACH).filter(k => grouped[k]).map(k => `<div class="badge" title="${esc(ACH[k].desc || '')}"><span aria-hidden="true">${ACH[k].icon}</span><b>${esc(ACH[k].name)}</b>${grouped[k] > 1 ? `<i>×${grouped[k]}</i>` : ''}<small class="tier t${ACH[k].tier}">${ACH[k].tier}</small></div>`).join('');
    const opp = ui.h2hOpp && DB.players[ui.h2hOpp] ? ui.h2hOpp : '';
    let h2h = '';
    if (opp) {
      const a = GS.h2hFor(id, opp), b = GS.h2hFor(opp, id);
      const line = (h, bat, bowl) => h ? `<div class="row between"><span>${esc(nm(bat))} batting v ${esc(nm(bowl))}</span><b>${h.runs} (${h.balls}) · out ${h.outs}× · SR ${sr(h.runs, h.balls)}</b></div>` : `<div class="muted small">${esc(nm(bat))} hasn't faced ${esc(nm(bowl))} yet</div>`;
      h2h = line(a, id, opp) + line(b, opp, id);
    }
    const r = pl.rt || { bat: 3, bowl: 3, field: 3 };
    const body = p ? `<div class="card"><h4>Batting</h4><div class="stats">${box('Matches', p.m.size)}${box('Runs', p.r)}${box('HS', p.hs + (p.hsNo ? '*' : ''))}${box('Avg', p.inn - p.no ? (p.r / (p.inn - p.no)).toFixed(1) : '-')}${box('SR', sr(p.r, p.b))}${box('30s/50s/100s', p.f30 + '/' + p.f50 + '/' + p.f100)}${box('4s', p.f4)}${box('6s', p.f6)}${box('Ducks', p.ducks)}</div></div>
      ${p.shots.length ? `<div class="card"><h4>🎯 Wagon wheel <span class="muted small">(${p.shots.length} shots)</span></h4><div class="center">${X.wheel(p.shots, !!pl.lh)}</div>${X.wheelSummary(p.shots, !!pl.lh)}</div>` : ''}
      <div class="card"><h4>Bowling</h4><div class="stats">${box('Overs', Engine.ovs(p.bb))}${box('Wkts', p.w)}${box('Best', p.best[0] ? p.best.join('/') : '-')}${box('Econ', econ(p.br, p.bb))}${box('Avg', p.w ? (p.br / p.w).toFixed(1) : '-')}${box('Wins', p.wins)}</div></div>
      <div class="card"><h4>Fielding</h4><div class="stats">${box('Catches', p.ct)}${box('Run outs', p.ro)}${box('Stumpings', p.st)}</div></div>
      <div class="card"><h4>Achievements</h4><div class="badges">${awards || '<span class="muted small">None yet – go get that fifty!</span>'}</div></div>
      <div class="card"><h4>Head-to-head</h4><select data-chg="h2hOpp" aria-label="Compare with"><option value="">Compare with…</option>${GS.everyone().filter(x => x.id !== id).sort((a, b) => a.name.localeCompare(b.name)).map(x => `<option value="${x.id}" ${x.id === opp ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>${h2h}</div>
      <div class="card"><h4>Recent</h4>${p.recent.slice(-10).reverse().map(x => `<div class="row between small"><span>${new Date(x.d).toLocaleDateString()}</span><b>${esc(x.t)}</b></div>`).join('')}</div>`
      : '<p class="muted">No career matches yet.</p>';
    return `${header(nm(id))}<main><div class="card"><div class="row gap"><input id="rename" value="${esc(nm(id))}" aria-label="Player name"><button type="button" class="btn" data-act="rename" data-id="${id}">Rename</button></div>
      <label class="chk mt"><input type="checkbox" data-chg="setLH" data-id="${id}" ${pl.lh ? 'checked' : ''}> Left-handed batter (flips the wagon wheel)</label>
      <div class="muted small">Team maker ratings: Bat ${r.bat} · Bowl ${r.bowl} · Field ${r.field}</div></div>
      <details id="dMerge" class="card"><summary>Merge duplicate player</summary><label for="mergeFrom">Merge another player into ${esc(nm(id))}</label><div class="row gap"><select id="mergeFrom"><option value="">Select duplicate…</option>${GS.everyone().filter(x => x.id !== id).map(x => `<option value="${x.id}">${esc(x.name)}</option>`).join('')}</select><button type="button" class="btn" data-act="merge" data-id="${id}">Merge</button></div></details>${body}</main>`;
  };

  // ================= SETTINGS =================
  V.settings = () => {
    const s = DB.settings;
    const tg = (k, label) => `<label class="chk"><input type="checkbox" data-chg="setFlag" data-k="${k}" ${s[k] ? 'checked' : ''}> ${label}</label>`;
    return `${header('Settings', false)}<main>
    <div class="card"><label for="meSel2">That's me (for Your stats on Home)</label><select id="meSel2" data-chg="setMe"><option value="">—</option>${GS.pool().sort((a, b) => a.name.localeCompare(b.name)).map(p => `<option value="${p.id}" ${p.id === s.me ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></div>
    <div class="card"><h4>Scoring</h4>
      ${tg('oneTap', 'One-tap scoring (plain runs record instantly)')}
      ${tg('wagon', 'Ask shot direction after scoring shots (wagon wheel)')}
      ${tg('voiceAuto', 'Voice: record the ball straight away (otherwise just pre-selects it)')}
      <label for="vm">Voice read-back</label><select id="vm" data-chg="setVoiceMode"><option value="after" ${s.voiceConfirm === 'after' ? 'selected' : ''}>Record, then read back what was scored (recommended)</option><option value="ask" ${s.voiceConfirm === 'ask' ? 'selected' : ''}>Read back first – record only after I say “yes”</option><option value="off" ${s.voiceConfirm === 'off' ? 'selected' : ''}>Silent – show on-screen log only</option></select>
      ${tg('voiceSpeak', 'Speak the read-back aloud (otherwise on screen only)')}
      <p class="muted tiny">Voice scoring uses your browser's speech recognition (best in Chrome on Android; needs internet on most phones).</p></div>
    <div class="card"><h4>🎙 Commentary</h4>${tg('speak', 'Speak commentary after every ball')}
      <button type="button" class="btn block" data-act="studio">Open Commentary studio (language, voices, styles, variety)</button></div>
    <div class="card"><h4>Live score, handover, polls & cloud sync</h4>
      <label for="liveUrl">Live/sync server URL</label><input id="liveUrl" placeholder="https://your-project-default-rtdb.firebaseio.com" value="${esc(s.liveUrl)}">
      <label for="appUrl">Public app URL (where this app is hosted)</label><input id="appUrl" placeholder="https://you.github.io/gully-scorer/" value="${esc(s.appUrl || GS.appUrl())}">
      <button type="button" class="btn block" data-act="saveServer">Save</button>
      <p class="muted tiny">Without a server you can still share scorecard links, images, PDFs, QR codes and offline handover links. With a free Firebase Realtime Database (see README) you also get live scores, server handover, tap-to-answer polls and cloud sync.</p>
      ${s.liveUrl ? `<div class="row gap wrap"><button type="button" class="btn" data-act="cloudPush">☁️⬆ Push my data</button><button type="button" class="btn" data-act="cloudPull">☁️⬇ Pull & merge</button></div>
      <div class="small mt">Your sync code: <b>${esc(s.syncCode || '(created on first push)')}</b> – enter it on another phone to pull.</div>` : ''}</div>
    <div class="card"><h4>Backup & phone-to-phone</h4><p class="small muted">All data lives on this phone. Share a backup file to another phone, then Import → Merge there.</p>
      <div class="row gap wrap"><button type="button" class="btn" data-act="export">📤 Share / export backup</button>
      <label class="btn">⬇ Import – merge<input type="file" data-imp="merge" accept=".json,application/json" hidden></label>
      <label class="btn">⬇ Import – replace<input type="file" data-imp="replace" accept=".json,application/json" hidden></label></div></div>
    <div class="card"><h4>Saved teams</h4>${DB.teams.map((t, i) => `<div class="row between"><span>${esc(t.name)} <span class="muted small">(${t.players.length})</span></span><button type="button" class="btn sm danger" data-act="delTeam" data-i="${i}" aria-label="Delete ${esc(t.name)}">✕</button></div>`).join('') || '<p class="muted small">Teams are saved automatically when you start a match.</p>'}</div>
    <div class="card"><button type="button" class="btn danger block" data-act="wipe">Erase all data</button></div>
    <p class="muted small center">Gully Scorer v4 · offline · no login</p></main>${tabbar('settings')}`;
  };

  // ================= SHEETS =================
  const opt = (ids, sel) => ids.map(id => `<option value="${id}" ${id === sel ? 'selected' : ''}>${esc(nm(id))}</option>`).join('');
  const addRow = team => `<div class="row gap"><input id="newP" placeholder="Add player to ${esc(team)}" aria-label="New player name"><button type="button" class="btn" data-act="addP">Add</button></div>`;
  S.openers = () => {
    const m = cur(), inn = m.innings[lastIdx(m)];
    const br = roster(m, inn.bat), bw = roster(m, 1 - inn.bat);
    return `<h3>Openers – ${esc(m.teams[inn.bat].name)}</h3>
      <label for="o1">Striker</label><select id="o1">${opt(br, br[0])}</select>
      <label for="o2">Non-striker</label><select id="o2"><option value="">— none (solo) —</option>${opt(br, br[1])}</select>
      <label for="o3">Bowler – ${esc(m.teams[1 - inn.bat].name)}</label><select id="o3">${opt(bw, bw.find(x => x !== br[0] && x !== br[1]) || bw[0])}</select>
      <label>Add player</label><div class="row gap"><select id="addTeam" aria-label="Team"><option value="${inn.bat}">${esc(m.teams[inn.bat].name)}</option><option value="${1 - inn.bat}">${esc(m.teams[1 - inn.bat].name)}</option></select><input id="newP" placeholder="Name" aria-label="New player name"><button type="button" class="btn" data-act="addP2">Add</button></div>
      <button type="button" class="btn block" data-act="editPlayers">✏️ Edit player names</button>
      <button type="button" class="btn primary block" data-act="startInnings">Start innings ▶</button>`;
  };
  S.batter = () => {
    const m = cur(), i = lastIdx(m), s = st(m, i), inn = m.innings[i];
    const av = roster(m, inn.bat).filter(id => id !== s.striker && id !== s.non && (!s.bat[id] || (s.bat[id].retired && !s.bat[id].dismissed)));
    return `<h3>Next batter</h3><div class="list">${av.map(id => `<button type="button" class="item" data-act="pickBat" data-id="${id}">${esc(nm(id))}${s.bat[id]?.retired ? ' <span class="muted small">(returns, retired hurt)</span>' : ''}</button>`).join('')}</div>
      ${addRow(m.teams[inn.bat].name)}<button type="button" class="btn block" data-act="editPlayers">✏️ Edit player names</button><button type="button" class="btn block" data-act="undo">↶ Undo last ball</button>`;
  };
  S.bowler = () => {
    const m = cur(), i = lastIdx(m), s = st(m, i), inn = m.innings[i], R = m.rules;
    const list = roster(m, 1 - inn.bat).map(id => {
      const w = s.bowl[id]; const quota = R.maxBowlerOvers && w && w.balls >= R.maxBowlerOvers * 6;
      const consec = !R.consecutive && id === s.lastBowler;
      const batting = id === s.striker || id === s.non;
      const dis = quota || consec || batting;
      return `<button type="button" class="item" data-act="pickBowl" data-id="${id}" ${dis ? 'disabled' : ''}>${esc(nm(id))} <span class="muted small">${w ? `${Engine.ovs(w.balls)}-${w.maidens}-${w.runs}-${w.wkts}` : ''}${consec ? ' · bowled last over' : quota ? ' · quota done' : batting ? ' · batting now' : ''}</span></button>`;
    }).join('');
    return `<h3>${ui.sheet?.change ? 'Change bowler' : 'Next over – bowler'}</h3><div class="list">${list}</div>${addRow(m.teams[1 - inn.bat].name)}<button type="button" class="btn block" data-act="editPlayers">✏️ Edit player names</button>
      ${ui.sheet?.change ? '<button type="button" class="btn block" data-act="closeSheet">Cancel</button>' : '<button type="button" class="btn block" data-act="undo">↶ Undo last ball</button>'}`;
  };
  // ================= AUDIT + MANUAL ADJUSTMENTS =================
  const auditActive = m => (m.audit || []).filter(a => a.kind === 'adj' && !['undone', 'reverted'].includes(a.status)).length;
  const auditPending = m => (m.audit || []).filter(a => ['adj', 'override'].includes(a.kind) && a.status === 'pending').length;
  const started = m => m.innings.some(x => x.events.length);
  function audit(m, rec) { (m.audit || (m.audit = [])).push(Object.assign({ id: GS.uid(), ts: Date.now() }, rec)); }
  GS.audit = audit; GS.auditPending = auditPending;
  const auditNote = m => auditPending(m) ? `<div class="card tight warn"><span>⚠ ${auditPending(m)} manual adjustment${auditPending(m) > 1 ? 's' : ''} not reviewed</span><button type="button" class="btn sm" data-act="review">🧾 Review</button></div>` : '';
  const KIND = { adj: '⚙ Score adjustment', revert: '↩ Reverted adjustment', override: '⚠ Override', roster: '👥 Player change' };
  const STAT = { pending: '⏳ to review', ok: '✅ approved', reverted: '↩ reverted', undone: '⎌ undone', info: 'ℹ note' };
  function auditList(m, interactive) {
    const L = (m.audit || []).slice().reverse();
    if (!L.length) return '<p class="muted small">Nothing exceptional has happened in this match.</p>';
    return L.map(a => `<div class="aud ${a.status}"><div class="row between small"><b>${KIND[a.kind] || esc(a.kind)}</b><span class="pill">${STAT[a.status] || ''}</span></div>
      <div class="muted tiny">${new Date(a.ts).toLocaleString()}${a.team ? ' · ' + esc(a.team) : ''}${a.inn != null ? ' · innings ' + (a.inn + 1) : ''}</div>
      ${a.reason || a.text ? `<div>${esc(a.reason || a.text)}</div>` : ''}${(a.detail || []).map(x => `<div class="small">• ${esc(x)}</div>`).join('')}
      ${a.before ? `<div class="small muted">${a.before.runs}/${a.before.wkts} (${a.before.overs}) → <b>${a.after.runs}/${a.after.wkts} (${a.after.overs})</b></div>` : ''}
      ${interactive && a.status === 'pending' ? `<div class="row gap mt"><button type="button" class="btn sm primary" data-act="audOk" data-id="${a.id}">✔ Approve</button>${a.revertable ? `<button type="button" class="btn sm danger" data-act="audRevert" data-id="${a.id}">↩ Revert</button>` : (a.kind === 'adj' ? '<span class="muted tiny">Includes a dismissal / crease change – fix with a new adjustment or Undo</span>' : '')}</div>` : ''}</div>`).join('');
  }
  function auditSection(m) {
    const n = (m.audit || []).length; if (!n) return '';
    return `<details id="dAud" class="card"><summary>🧾 Audit log (${n})${auditPending(m) ? ` · <span class="pill yellow">${auditPending(m)} to review</span>` : ''}</summary>${auditList(m, false)}</details>`;
  }
  S.review = () => {
    const m = cur(), p = auditPending(m);
    return `<h3>🧾 Audit log & review</h3><p class="muted small">Every manual adjustment, override and player change in this match is recorded here. Approve what is correct or revert what is not – you can also do this later from the scorecard.</p>
      ${p ? `<button type="button" class="btn block" data-act="audAll">✔ Approve all ${p} pending</button>` : ''}
      <div class="audlist">${auditList(m, true)}</div><button type="button" class="btn primary block" data-act="closeSheet">Done</button>`;
  };
  const parseOvers = str => { const x = /^\s*(\d+)(?:\.(\d))?\s*$/.exec(String(str)); if (!x) return null; const b = +(x[2] || 0); return b > 5 ? null : +x[1] * 6 + b; };
  function captureAdj() { const sh = ui.sheet; if (!sh || sh.type !== 'adjust') return; sh.draft = sh.draft || {}; document.querySelectorAll('.sheet [id^="ad"]').forEach(el => { if (el.id) sh.draft[el.id] = el.value; }); }
  const REASONS = ['Missed scoring', 'Wrong entry corrected', 'Dispute / umpire decision', 'Player joined late', 'Other'];
  S.adjust = () => {
    const m = cur(), sh = ui.sheet, D = sh.draft || {};
    const cands = m.innings.map((x, k) => k).filter(k => m.innings[k].events.length);
    const i = sh.inn != null && cands.includes(sh.inn) ? sh.inn : lastIdx(m);
    const inn = m.innings[i], s = st(m, i);
    const V0 = (k, d) => (D[k] !== undefined ? D[k] : d);
    const batIds = s.batOrder.concat((sh.addBat || []).filter(id => !s.batOrder.includes(id)));
    const bowlIds = s.bowlOrder.concat((sh.addBowl || []).filter(id => !s.bowlOrder.includes(id)));
    const bat = id => s.bat[id] || { r: 0, b: 0, f4: 0, f6: 0, dismissed: false, out: null };
    const bwl = id => s.bowl[id] || { balls: 0, runs: 0, wkts: 0 };
    const nin = (id, v, extra = '') => `<input id="${id}" type="number" inputmode="numeric" class="nin" value="${esc(V0(id, v))}" data-prev="${esc(V0(id, v))}" ${extra}>`;
    const roBat = roster(m, inn.bat), roBowl = roster(m, 1 - inn.bat);
    const crOpts = sel => `<option value="">(no change)</option>${roBat.filter(id => !s.bat[id]?.dismissed).map(id => `<option value="${id}" ${V0(sel, '') === id ? 'selected' : ''}>${esc(nm(id))}</option>`).join('')}`;
    return `<h3>⚙ Adjust score</h3>
      <p class="muted small">Type the <b>correct</b> values – the app works out the difference. Everything is recorded in the audit log for review at the end.</p>
      ${cands.length > 1 ? `<label for="ad_inn">Innings</label><select id="ad_inn" data-chg="adInn">${cands.map(k => `<option value="${k}" ${k === i ? 'selected' : ''}>${esc(m.teams[m.innings[k].bat].name)}${isSuper(m, k) ? ' (Super Over)' : ''} – ${st(m, k).runs}/${st(m, k).wkts}</option>`).join('')}</select>` : ''}
      <div class="card tight"><b>${esc(m.teams[inn.bat].name)} – team total</b>
        <div class="grid3"><div><label for="ad_runs">Runs</label>${nin('ad_runs', s.runs)}</div><div><label for="ad_wkts">Wickets</label>${nin('ad_wkts', s.wkts)}</div><div><label for="ad_overs">Overs</label><input id="ad_overs" class="nin" inputmode="decimal" value="${esc(V0('ad_overs', s.oversStr))}"></div></div></div>
      <div class="card tight"><b>Batters</b> <span class="muted tiny">R · B · 4s · 6s (changing a batter's runs also moves the team runs)</span>
        ${batIds.map(id => { const b = bat(id); return `<div class="adrow"><span class="adn">${esc(short(id))}<small class="muted tiny"> ${esc(b.dismissed ? b.out : s.bat[id] ? (id === s.striker || id === s.non ? 'batting' : 'not out') : 'new')}</small></span>${nin('adb_r_' + id, b.r)}${nin('adb_b_' + id, b.b)}${nin('adb_4_' + id, b.f4)}${nin('adb_6_' + id, b.f6)}
          ${b.dismissed ? '' : `<select id="adb_o_${id}" class="adst" aria-label="Status of ${esc(nm(id))}"><option value="">still in / not out</option><option value="out" ${V0('adb_o_' + id, '') === 'out' ? 'selected' : ''}>Mark OUT (adds a wicket)</option></select>`}</div>`; }).join('') || '<p class="muted small">No batters yet.</p>'}
        <select id="adAddBat" data-chg="adAddBat" aria-label="Add a batter who already played"><option value="">＋ Add a batter who already played…</option>${roBat.filter(id => !batIds.includes(id)).map(id => `<option value="${id}">${esc(nm(id))}</option>`).join('')}</select>
        <div class="grid2"><div><label for="ad_str">Now on strike</label><select id="ad_str">${crOpts('ad_str')}</select></div><div><label for="ad_non">Non-striker</label><select id="ad_non">${crOpts('ad_non')}</select></div></div></div>
      <div class="card tight"><b>Bowlers</b> <span class="muted tiny">Overs · R · W</span>
        ${bowlIds.map(id => { const w = bwl(id); return `<div class="adrow"><span class="adn">${esc(short(id))}</span><input id="adw_o_${id}" class="nin" inputmode="decimal" value="${esc(V0('adw_o_' + id, Engine.ovs(w.balls)))}">${nin('adw_r_' + id, w.runs)}${nin('adw_w_' + id, w.wkts)}</div>`; }).join('') || '<p class="muted small">No bowlers yet.</p>'}
        <select id="adAddBowl" data-chg="adAddBowl" aria-label="Add a bowler who already bowled"><option value="">＋ Add a bowler who already bowled…</option>${roBowl.filter(id => !bowlIds.includes(id)).map(id => `<option value="${id}">${esc(nm(id))}</option>`).join('')}</select></div>
      <label for="ad_reasonSel">Reason (required)</label><select id="ad_reasonSel">${REASONS.map(r => `<option ${V0('ad_reasonSel', REASONS[0]) === r ? 'selected' : ''}>${r}</option>`).join('')}</select>
      <input id="ad_reason" placeholder="Note (optional – required for “Other”)" maxlength="120" value="${esc(V0('ad_reason', ''))}" aria-label="Note">
      <div class="row gap mt"><button type="button" class="btn" data-act="closeSheet">Cancel</button><button type="button" class="btn primary grow" data-act="adjSave">Save adjustment</button></div>`;
  };
  function fixTarget(m, i) {
    const nx = m.innings[i + 1]; if (!nx || i % 2 !== 0 || nx.target == null) return null;
    const nt = st(m, i).runs + 1; if (nx.target === nt) return null; nx.target = nt; return nt;
  }
  const sgn = n => (n > 0 ? '+' : '') + n;
  const tossText = (c, nA, nB) => `It's ${c.result.toUpperCase()}! ${esc(c.winner === 0 ? nA : nB)} win the toss – now choose bat or bowl ⬇`;
  const usedIds = m => { const u = new Set(); m.innings.forEach(inn => inn.events.forEach(e => { GS.remapEv(JSON.parse(JSON.stringify(e)), x => { u.add(x); return x; }); })); return u; };
  S.players = () => {
    const m = cur(), used = usedIds(m);
    const blk = t => `<div class="pteam"><b>${esc(m.teams[t].name)}</b> <span class="muted small">(${m.teams[t].players.length} players)</span>
      ${m.teams[t].players.map(id => `<div class="row gap pedit"><input id="pe_${id}" value="${esc(nm(id))}" maxlength="30" aria-label="Player name"><button type="button" class="btn sm" data-act="pSave" data-id="${id}" data-t="${t}">Save</button><button type="button" class="btn sm danger" data-act="pDel" data-id="${id}" data-t="${t}" aria-label="Remove ${esc(nm(id))}" ${used.has(id) || m.teams[t].players.length <= 2 ? 'disabled' : ''}>✕</button></div>`).join('')}
      <div class="row gap pedit"><input id="pa_${t}" placeholder="Add player to ${esc(m.teams[t].name)}" maxlength="30" aria-label="New player name"><button type="button" class="btn sm" data-act="pAdd" data-t="${t}">Add</button></div></div>`;
    return `<h3>Edit players</h3><p class="muted small">Change a name and tap Save. Players who have already batted or bowled can be renamed but not removed. Adding a player to a team that is “all out” lets the innings continue.</p>${blk(0)}${blk(1)}<button type="button" class="btn primary block" data-act="closeSheet">Done</button>`;
  };
  function syncSaved(m) {
    if (m.tour) return;
    m.teams.forEach(t => { const ids = t.players.filter(id => !DB.players[id]?.tmp); const rec = DB.teams.find(x => x.name.toLowerCase() === t.name.toLowerCase()); if (rec) rec.players = ids; else if (ids.length) DB.teams.push({ name: t.name, players: ids }); });
  }
  function swapInMatch(m, from, to) {
    m.teams.forEach(t => { t.players = [...new Set(t.players.map(x => x === from ? to : x))]; });
    m.innings.forEach(inn => inn.events.forEach(e => GS.remapEv(e, x => x === from ? to : x)));
    if (m.pom === from) m.pom = to;
    if (DB.players[from]?.tmp && !DB.matches.some(x => x !== m && x.teams.some(t => t.players.includes(from)))) delete DB.players[from];
  }
  function wicketTypes(m, s) {
    const ex = ui.sel.ex, R = m.rules;
    let types = ['Bowled', 'Caught', 'LBW', 'Run out', 'Stumped', 'Hit wicket'];
    if (R.oneTip) types.push('One tip one hand');
    if (R.hitOutside) types.push('Hit outside');
    if (s.freeHit || ex === 'nb' || ex === 'b' || ex === 'lb') types = ['Run out'];
    else if (ex === 'wd') types = ['Run out', 'Stumped', 'Hit wicket'];
    return types;
  }
  GS.wicketTypes = wicketTypes;
  S.wicket = () => {
    const m = cur(), i = lastIdx(m), s = st(m, i), inn = m.innings[i];
    const types = wicketTypes(m, s), t = types.includes(ui.sheet.wt) ? ui.sheet.wt : types[0];
    const needF = ['Caught', 'Run out', 'Stumped', 'One tip one hand'].includes(t);
    const who = ui.sheet.who || s.striker;
    return `<h3>How out?${s.freeHit ? ' <span class="pill yellow">FREE HIT</span>' : ''}</h3>
      <div class="chips">${types.map(x => `<button type="button" class="tog ${x === t ? 'sel' : ''}" data-act="wt" data-k="${x}">${x}</button>`).join('')}</div>
      ${t === 'Run out' && s.non ? `<label>Who is out?</label><div class="chips">${[s.striker, s.non].map(id => `<button type="button" class="tog ${id === who ? 'sel' : ''}" data-act="who" data-id="${id}">${esc(nm(id))}</button>`).join('')}</div>` : ''}
      ${needF ? `<label for="fielder">Fielder</label><select id="fielder"><option value="">—</option>${opt(roster(m, 1 - inn.bat), ui.sheet.f)}</select>` : ''}
      ${t === 'Run out' ? '<p class="muted small">Runs completed before the run out are taken from the run you selected.</p>' : ''}
      <div class="row gap"><button type="button" class="btn" data-act="closeSheet">Cancel</button><button type="button" class="btn danger grow" data-act="commitWicket">Confirm wicket</button></div>`;
  };
  S.menu = () => {
    const m = cur(), i = lastIdx(m), s = m.innings[i]?.events.length ? st(m, i) : null;
    return `<h3>Match menu</h3><div class="list">
      <button type="button" class="item" data-act="editPlayers">👥 Edit / add players</button>
      ${m.innings.some(x => x.events.length) ? '<button type="button" class="item" data-act="adjOpen">⚙ Adjust score / overs / player scores</button>' : ''}
      <button type="button" class="item" data-act="review">🧾 Audit log & review${auditPending(m) ? ` (${auditPending(m)} to review)` : ''}</button>
      ${s && !s.done ? `<button type="button" class="item" data-act="swap">⇄ Swap strike</button>
      <button type="button" class="item" data-act="retireMenu">🩹 Retire batter</button>
      <button type="button" class="item" data-act="changeBowler">🔄 Change bowler (mid-over)</button>
      <button type="button" class="item" data-act="endInnings">⏹ End innings now</button>` : ''}
      <button type="button" class="item" data-act="goLive">${m.live ? '📡 Live link & QR (sharing on)' : '📡 Go Live – share live score'}</button>
      <button type="button" class="item" data-act="handover">📲 Hand over scoring to another phone</button>
      <button type="button" class="item" data-act="toggleSpeak">${DB.settings.speak ? '🔇 Stop speaking commentary' : '🔊 Speak commentary'}</button>
      <button type="button" class="item" data-act="studio">🎙 Commentary studio</button>
      <button type="button" class="item" data-act="card" data-id="${m.id}">📋 Full scorecard & commentary</button>
      <button type="button" class="item" data-act="shareMenu" data-id="${m.id}">📤 Share score</button>
      <button type="button" class="item danger" data-act="abandon">✕ Abandon match</button></div>
      <button type="button" class="btn block" data-act="closeSheet">Close</button>`;
  };
  S.retire = () => {
    const m = cur(), s = st(m, lastIdx(m));
    return `<h3>Retire batter</h3><div class="list">${[s.striker, s.non].filter(Boolean).map(id => `
      <div class="row between item"><span>${esc(nm(id))}</span><span class="row gap"><button type="button" class="btn sm" data-act="retire" data-id="${id}" data-k="hurt">Hurt</button><button type="button" class="btn sm danger" data-act="retire" data-id="${id}" data-k="out">Out</button></span></div>`).join('')}</div>
      <p class="muted small">Retired hurt can bat again later. Retired out counts as a wicket.</p><button type="button" class="btn block" data-act="closeSheet">Cancel</button>`;
  };
  S.share = () => {
    const m = getMatch(ui.sheet.id);
    return `<h3>Share – ${esc(m.teams[0].name)} vs ${esc(m.teams[1].name)}</h3><div class="list">
      <button type="button" class="item" data-act="shareImg">🖼 Scorecard image (PNG)</button>
      <button type="button" class="item" data-act="sharePdf">📄 Scorecard PDF</button>
      <button type="button" class="item" data-act="shareLink">🔗 Scorecard link (opens in any browser)</button>
      <button type="button" class="item" data-act="shareLinkQR">▦ Scorecard QR code</button>
      <button type="button" class="item" data-act="shareTxt">💬 Text summary (WhatsApp)</button>
      <button type="button" class="item" data-act="shareComm">🎙 Commentary text</button>
      ${m.status === 'live' && m.id === DB.current ? `<button type="button" class="item" data-act="goLive">📡 Live link & QR</button>` : ''}</div>
      <button type="button" class="btn block" data-act="closeSheet">Close</button>`;
  };
  S.live = () => {
    const m = cur(), link = GS.liveLink(m);
    if (!GS.liveBase()) return `<h3>Go Live</h3><p class="small">To let friends follow ball by ball, add a live server URL in <b>Settings</b> (free Firebase Realtime Database – steps in the README).</p><p class="small muted">Until then you can share a scorecard link or QR snapshot any time from Share.</p><div class="grid2"><button type="button" class="btn" data-act="go" data-v="settings">Open Settings</button><button type="button" class="btn primary" data-act="shareLink">Share snapshot link</button></div>`;
    if (!link) return `<h3>Go Live</h3><p class="small">Set the <b>Public app URL</b> in Settings so the link opens your hosted app.</p><button type="button" class="btn block" data-act="go" data-v="settings">Open Settings</button>`;
    return `<h3>📡 Live is ON</h3><p class="small">Anyone who scans this QR or opens the link sees the score and commentary refresh every 5 seconds.</p>
      <div class="qrbox">${QR.svg(link) || ''}</div>
      <input readonly value="${esc(link)}" aria-label="Live link" onclick="this.select()">
      <div class="grid2 mt"><button type="button" class="btn primary" data-act="shareLiveLink">Share link</button><button type="button" class="btn danger" data-act="stopLive">Stop live</button></div>
      <div class="muted small mt">Status: ${esc(ui.liveState || 'waiting for first ball')}</div>
      <button type="button" class="btn block" data-act="closeSheet">Close</button>`;
  };

  // ================= RENDER =================
  const CLOSABLE = ['soloNext', 'soloAudit', 'players', 'review', 'wicket', 'menu', 'retire', 'share', 'live', 'qr', 'handover', 'rateSuggest', 'catLines'];
  function render() {
    let html = (V[ui.view] || V.home)();
    if (ui.sheet && S[ui.sheet.type]) {
      const closable = CLOSABLE.includes(ui.sheet.type) || ui.sheet.change;
      html += `<div class="backdrop" ${closable ? 'data-act="closeSheet"' : ''}></div><div class="sheet" role="dialog" aria-modal="true">${S[ui.sheet.type]()}</div>`;
    }
    if (ui.toast) html += `<div class="toast" role="status">${esc(ui.toast)}</div>`;
    const y = window.scrollY, sy = app.querySelector('.sheet')?.scrollTop;
    const open = {}; app.querySelectorAll('details[id]').forEach(d => open[d.id] = d.open);
    const sameView = app.dataset.view === ui.view;
    app.innerHTML = html; app.dataset.view = ui.view;
    if (sameView) app.querySelectorAll('details[id]').forEach(d => { if (d.id in open) d.open = open[d.id]; });
    if (sy) { const sh = app.querySelector('.sheet'); if (sh) sh.scrollTop = sy; }
    window.scrollTo(0, y);
  }
  GS.render = render;

  // ================= ACTIONS =================
  const push = ev => { const m = cur(); m.innings[lastIdx(m)].events.push(ev); save(); };
  function commitBall(extra, opts = {}) {
    const { runs, ex } = ui.sel;
    const pend = ui.sheet?.type === 'wagon' ? ui.sheet.extra : null;
    const all = Object.assign({}, pend || {}, extra || {});
    const scoringShot = (runs || 0) > 0 && (!ex || ex === 'nb');
    if (!opts.noWagon && DB.settings.wagon && scoringShot && !all.wg) { ui.sheet = { type: 'wagon', extra: all }; render(); return; }
    push(Object.assign({ t: 'ball', runs: runs ?? 0, extra: ex || null }, all));
    resetSel(); ui.sheet = null; ui.lastLine = '';
    if (navigator.vibrate) navigator.vibrate(15);
    if (GS.voiceHook) GS.voiceHook();
    GS.speakLatest(cur());
    render();
  }
  GS.commitBall = commitBall;
  const sayOne = (key, c) => { const sp = Comm.say([{ key, c }]); if (sp[0]) ui.lastLine = sp[0].text; };
  function addPlayer(team, inpId = 'newP') {
    const inp = document.getElementById(inpId); const name = inp?.value.trim();
    if (!name) return toast('Type a name first');
    const m = cur(); const id = playerByName(name);
    if (m.teams[team].players.includes(id)) return toast('Already in this team');
    if (m.teams[1 - team].players.includes(id) && !m.rules.common) return toast('Already in the other team');
    m.teams[team].players.push(id); if (started(m)) audit(m, { kind: 'roster', status: 'info', team: m.teams[team].name, text: `${nm(id)} added to the team` }); syncSaved(m); save(); render();
  }
  function undo() {
    const m = cur(); if (!m) return;
    m.status = 'live'; m.result = null; m.pom = null; ui.lastLine = '';
    TTS.cancel();
    const inn = m.innings[lastIdx(m)];
    if (!inn.events.length) {
      if (m.innings.length > 1) m.innings.pop(); else { toast('Nothing to undo'); return; }
    } else {
      while (inn.events.length) {
        const e = inn.events.pop();
        if (e.t === 'adj') { const a = (m.audit || []).find(x => x.aid === e.aid); if (a) a.status = 'undone'; if (e.rev) { const o = (m.audit || []).find(x => x.aid === e.rev); if (o) o.status = 'pending'; } }
        if (['ball', 'start', 'retire', 'end', 'swap', 'adj'].includes(e.t)) break;
      }
    }
    resetSel(); ui.sheet = null; save(); render();
  }
  async function copyOrShare(text, title, url) {
    try {
      if (navigator.share) { await navigator.share(url ? { title, url, text: title } : { title, text }); return; }
      await navigator.clipboard.writeText(url || text); toast('Copied – paste it in WhatsApp');
    } catch (e) { if (e?.name !== 'AbortError') prompt('Copy this:', url || text); }
  }
  GS.copyOrShare = copyOrShare;
  const fileName = (m, ext) => `${m.teams[0].name}-vs-${m.teams[1].name}-${new Date(m.created).toISOString().slice(0, 10)}.${ext}`.replace(/[^\w.-]+/g, '_');
  async function ownerCheck(m) {
    if (!m?.live || !GS.liveBase()) return true;
    try { const o = await GS.jget(`${GS.liveBase()}/gully/${m.live}/owner.json`); if (o && o !== DB.settings.dev) { m.status = 'handed'; m.handedAt = Date.now(); DB.current = null; save(); toast('Another phone is scoring this match now'); ui.view = 'home'; render(); return false; } } catch { }
    return true;
  }

  Object.assign(A, {
    back: () => {
      ui.sheet = null;
      const map = { player: 'stats', tour: 'tours', tourNew: 'tours', poll: 'polls', soloNew: 'solo', soloPlay: 'solo' };
      if (ui.view === 'setup' && ui.prefill?.fromTm) ui.view = 'teams';
      else if (ui.view === 'setup' && ui.prefill?.tour) ui.view = 'tour';
      else if (ui.view === 'card' && ui.prevView) ui.view = ui.prevView;
      else if (ui.view === 'studio') ui.view = ui.studioFrom && ui.studioFrom !== 'studio' ? ui.studioFrom : 'settings';
      else ui.view = map[ui.view] || 'home';
      ui.prevView = null; render();
    },
    go: d => { ui.sheet = null; if (d.v !== 'setup') { ui.coin = null; ui.coinRot = 0; } ui.view = d.v; if (d.tab) ui.statsTab = d.tab; window.scrollTo(0, 0); render(); },
    newMatch: () => { if (cur()?.status === 'live' && !confirm('A match is in progress. Start a new one anyway? (It stays saved as in-progress.)')) return; ui.prefill = null; ui.coin = null; ui.coinRot = 0; ui.view = 'setup'; render(); },
    resume: async () => { const m = cur(); if (!(await ownerCheck(m))) return; ui.view = 'score'; ui.sheet = null; render(); },
    card: d => { ui.prevView = ['tour', 'matches'].includes(ui.view) ? ui.view : null; ui.cardId = d.id; ui.view = 'card'; ui.sheet = null; window.scrollTo(0, 0); render(); },
    player: d => { ui.playerId = d.id; ui.h2hOpp = ''; ui.view = 'player'; window.scrollTo(0, 0); render(); },
    stab: d => { ui.statsTab = d.k; render(); },
    menu: () => { ui.sheet = { type: 'menu' }; render(); },
    closeSheet: () => { ui.sheet = null; render(); },
    adjOpen: () => { ui.sheet = { type: 'adjust', inn: null, draft: {}, addBat: [], addBowl: [] }; render(); },
    adInn: (d, el) => { const keep = { ad_reasonSel: document.getElementById('ad_reasonSel')?.value, ad_reason: document.getElementById('ad_reason')?.value }; ui.sheet.inn = +el.value; ui.sheet.draft = keep; ui.sheet.addBat = []; ui.sheet.addBowl = []; render(); },
    adAddBat: (d, el) => { if (!el.value) return; captureAdj(); ui.sheet.addBat.push(el.value); render(); },
    adAddBowl: (d, el) => { if (!el.value) return; captureAdj(); ui.sheet.addBowl.push(el.value); render(); },
    adjSave: () => {
      captureAdj();
      const m = cur(), sh = ui.sheet, D = sh.draft;
      const cands = m.innings.map((x, k) => k).filter(k => m.innings[k].events.length);
      const i = sh.inn != null && cands.includes(sh.inn) ? sh.inn : lastIdx(m), inn = m.innings[i], s = st(m, i);
      const n = (k, cur0) => { const v = D[k]; if (v === undefined || v === '') return cur0; const x = Number(v); return Number.isFinite(x) && x >= 0 ? Math.round(x) : NaN; };
      const runs = n('ad_runs', s.runs), wk = n('ad_wkts', s.wkts), balls = parseOvers(D.ad_overs ?? s.oversStr);
      if ([runs, wk].some(Number.isNaN) || balls == null) return toast('Enter valid numbers (overs like 7.3)');
      const reasonSel = D.ad_reasonSel || REASONS[0], note = (D.ad_reason || '').trim();
      if (reasonSel === 'Other' && !note) return toast('Please add a note for “Other”');
      const reason = reasonSel + (note ? ': ' + note : '');
      const batIds = s.batOrder.concat((sh.addBat || []).filter(id => !s.batOrder.includes(id)));
      const bowlIds = s.bowlOrder.concat((sh.addBowl || []).filter(id => !s.bowlOrder.includes(id)));
      const detail = [], batRows = [], bowlRows = []; let outs = 0, bad = false;
      batIds.forEach(id => {
        const b = s.bat[id] || { r: 0, b: 0, f4: 0, f6: 0 };
        const r = n('adb_r_' + id, b.r), bb = n('adb_b_' + id, b.b), f4 = n('adb_4_' + id, b.f4), f6 = n('adb_6_' + id, b.f6);
        if ([r, bb, f4, f6].some(Number.isNaN)) { bad = true; return; }
        const out = D['adb_o_' + id] === 'out' && !s.bat[id]?.dismissed;
        const row = { p: id, r: r - b.r, b: bb - b.b, f4: f4 - b.f4, f6: f6 - b.f6 };
        if (row.r || row.b || row.f4 || row.f6 || out || !s.bat[id]) {
          if (out) { row.out = 1; outs++; }
          batRows.push(row);
          const parts = [row.r && `${sgn(row.r)} runs`, row.b && `${sgn(row.b)} balls`, row.f4 && `${sgn(row.f4)} fours`, row.f6 && `${sgn(row.f6)} sixes`, out && 'marked OUT'].filter(Boolean);
          detail.push(`${nm(id)}: ${parts.join(', ') || 'added to batting card'}`);
        }
      });
      bowlIds.forEach(id => {
        const w = s.bowl[id] || { balls: 0, runs: 0, wkts: 0 };
        const ob = parseOvers(D['adw_o_' + id] ?? Engine.ovs(w.balls)), r = n('adw_r_' + id, w.runs), wk2 = n('adw_w_' + id, w.wkts);
        if (ob == null || [r, wk2].some(Number.isNaN)) { bad = true; return; }
        const row = { p: id, b: ob - w.balls, r: r - w.runs, w: wk2 - w.wkts };
        if (row.b || row.r || row.w) { bowlRows.push(row); detail.push(`${nm(id)} (bowling): ${[row.b && `${sgn(row.b)} balls`, row.r && `${sgn(row.r)} runs`, row.w && `${sgn(row.w)} wkts`].filter(Boolean).join(', ')}`); }
      });
      if (bad) return toast('Enter valid numbers (overs like 3.2)');
      const team = { runs: runs - s.runs, balls: balls - s.legal, wkts: wk === s.wkts ? 0 : wk - s.wkts - outs };  // untouched wickets box: named dismissals add their own wickets
      const crease = {}; const cs = D.ad_str, cn = D.ad_non;
      if (cs && cs === cn) return toast('Striker and non-striker must differ');
      if (cs) crease.striker = cs; if (cn) crease.non = cn;
      const teamParts = [team.runs && `${sgn(team.runs)} runs`, team.balls && `${sgn(team.balls)} balls`, team.wkts && `${sgn(team.wkts)} wickets (not attributed to a batter)`].filter(Boolean);
      if (teamParts.length) detail.unshift('Team: ' + teamParts.join(', '));
      if (Object.keys(crease).length) detail.push('Crease: ' + [crease.striker && 'striker → ' + nm(crease.striker), crease.non && 'non-striker → ' + nm(crease.non)].filter(Boolean).join(', '));
      if (!detail.length) return toast('Nothing changed');
      if (!confirm(`Record this adjustment?\n\n${detail.join('\n')}\n\nReason: ${reason}\nIt will be logged for review.`)) return;
      const ev = { t: 'adj', aid: GS.uid(), reason };
      if (team.runs || team.balls || team.wkts) ev.team = Object.fromEntries(Object.entries(team).filter(([, v]) => v));
      if (batRows.length) ev.bat = batRows; if (bowlRows.length) ev.bowl = bowlRows; if (Object.keys(crease).length) ev.crease = crease;
      const before = { runs: s.runs, wkts: s.wkts, overs: s.oversStr };
      inn.events.push(ev);
      const s2 = st(m, i), nt = fixTarget(m, i); if (nt) detail.push(`Chase target revised to ${nt}`);
      audit(m, { kind: 'adj', aid: ev.aid, inn: i, team: m.teams[inn.bat].name, reason, detail, before, after: { runs: s2.runs, wkts: s2.wkts, overs: s2.oversStr }, status: 'pending', revertable: !batRows.some(x => x.out) && !ev.crease });
      ui.sheet = null; resetSel(); save(); render(); toast('Adjustment saved & logged ✔');
    },
    review: () => { ui.sheet = { type: 'review' }; render(); },
    audOk: d => { const a = cur().audit.find(x => x.id === d.id); if (a) { a.status = 'ok'; a.reviewedAt = Date.now(); } save(); render(); },
    audAll: () => { const t = Date.now(); (cur().audit || []).forEach(a => { if (a.status === 'pending') { a.status = 'ok'; a.reviewedAt = t; } }); save(); render(); },
    audRevert: d => {
      const m = cur(), a = m.audit.find(x => x.id === d.id), inn = a && m.innings[a.inn], ev = inn?.events.find(e => e.aid === a.aid);
      if (!ev || !a.revertable) return toast('This one cannot be auto-reverted');
      if (!confirm('Revert this adjustment? A reversing entry is added to the log (nothing is deleted).')) return;
      const neg = { t: 'adj', aid: GS.uid(), rev: a.aid, reason: 'Reverted: ' + a.reason };
      if (ev.team) neg.team = Object.fromEntries(Object.entries(ev.team).map(([k, v]) => [k, -v]));
      if (ev.bat) neg.bat = ev.bat.map(x => ({ p: x.p, r: -(x.r || 0), b: -(x.b || 0), f4: -(x.f4 || 0), f6: -(x.f6 || 0) }));
      if (ev.bowl) neg.bowl = ev.bowl.map(x => ({ p: x.p, b: -(x.b || 0), r: -(x.r || 0), w: -(x.w || 0) }));
      const s0 = st(m, a.inn); inn.events.push(neg); const s1 = st(m, a.inn), nt = fixTarget(m, a.inn);
      a.status = 'reverted';
      audit(m, { kind: 'revert', aid: neg.aid, inn: a.inn, team: m.teams[inn.bat].name, text: 'Reverted: ' + a.reason, detail: nt ? [`Chase target revised to ${nt}`] : [], before: { runs: s0.runs, wkts: s0.wkts, overs: s0.oversStr }, after: { runs: s1.runs, wkts: s1.wkts, overs: s1.oversStr }, status: 'info' });
      save(); render(); toast('Reverted');
    },
    flipCoin: (d, el) => {
      const v = id => document.getElementById(id), coin = v('coin'); if (!coin || ui.flipping) return;
      const nA = v('tA').value.trim() || 'Team A', nB = v('tB').value.trim() || 'Team B';
      const caller = +v('caller').value, call = v('call').value;
      const rnd = new Uint32Array(1); (window.crypto || window.msCrypto).getRandomValues(rnd);
      const result = rnd[0] % 2 ? 'tails' : 'heads';
      ui.flipping = true; el.disabled = true; v('tossMsg').textContent = 'Flipping…';
      const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
      const rot = Math.ceil((ui.coinRot || 0) / 360) * 360 + (reduce ? 0 : 1440) + (result === 'tails' ? 180 : 0);
      ui.coinRot = rot; coin.style.transform = `rotateY(${rot}deg)`;
      const wrap = v('coinWrap'); wrap.classList.remove('hop'); void wrap.offsetWidth; if (!reduce) wrap.classList.add('hop');
      setTimeout(() => {
        const winner = result === call ? caller : 1 - caller;
        ui.coin = { caller, call, result, winner }; ui.flipping = false;
        if (v('toss')) v('toss').value = String(winner);
        if (v('tossMsg')) v('tossMsg').innerHTML = tossText(ui.coin, nA, nB);
        if (v('flipBtn')) { v('flipBtn').disabled = false; v('flipBtn').textContent = '🪙 Flip again'; }
        if (navigator.vibrate) navigator.vibrate(40);
      }, reduce ? 50 : 1900);
    },
    tossManual: () => { ui.coin = null; const t = document.getElementById('tossMsg'); if (t) t.textContent = ''; const b = document.getElementById('flipBtn'); if (b) b.textContent = '🪙 Flip the coin'; },
    editPlayers: () => { ui.sheet = { type: 'players' }; render(); },
    pAdd: d => addPlayer(+d.t, 'pa_' + d.t),
    pDel: d => {
      const m = cur(), t = +d.t; if (usedIds(m).has(d.id)) return toast('Already played – cannot remove');
      if (m.teams[t].players.length <= 2) return toast('A team needs at least 2 players');
      if (started(m)) audit(m, { kind: 'roster', status: 'info', team: m.teams[t].name, text: `${nm(d.id)} removed (had not played)` });
      m.teams[t].players = m.teams[t].players.filter(x => x !== d.id);
      if (DB.players[d.id]?.tmp && !DB.matches.some(x => x !== m && x.teams.some(tt => tt.players.includes(d.id)))) delete DB.players[d.id];
      syncSaved(m); save(); render();
    },
    pSave: d => {
      const m = cur(), t = +d.t, id = d.id, p = DB.players[id];
      const name = (document.getElementById('pe_' + id)?.value || '').trim();
      if (!name) return toast('Name cannot be empty');
      if (p && name === p.name) return toast('No change');
      const other = GS.pool().concat(Object.values(DB.players).filter(x => x.tmp)).find(x => x.id !== id && x.name.toLowerCase() === name.toLowerCase());
      if (p?.tmp && !other) { const old = p.name; p.name = name; delete p.tmp; if (started(m)) audit(m, { kind: 'roster', status: 'info', team: m.teams[t].name, text: `Placeholder “${old}” named “${name}”` }); syncSaved(m); save(); return toast('Saved'); }
      const to = other ? other.id : null;
      if (to && m.teams[t].players.includes(to)) return toast(`${name} is already in this team`);
      if (to && m.teams[1 - t].players.includes(to) && !m.rules.common) return toast(`${name} is in the other team`);
      if (!p?.tmp && !confirm(`Change ${nm(id)} to “${name}” in THIS match only?\n(To fix a spelling everywhere, open the player's profile → Rename.)`)) return;
      const oldName = nm(id);
      swapInMatch(m, id, to || playerByName(name));
      if (started(m)) audit(m, { kind: 'roster', status: 'info', team: m.teams[t].name, text: `${oldName} replaced by ${name} in this match` });
      syncSaved(m); save(); toast('Saved'); render();
    },
    startMatch: () => {
      const v = id => document.getElementById(id);
      const mk = k => {
        const name = v('t' + k).value.trim() || 'Team ' + k;
        let names = v('p' + k).value.split('\n').map(x => x.trim()).filter(Boolean);
        if (!names.length) {
          const n = Math.max(2, Math.min(15, +v('n' + k).value || 6));
          const ids = Array.from({ length: n }, (_, j) => { const id = GS.uid(); DB.players[id] = { id, name: `${name} ${j + 1}`, tmp: true }; return id; });
          return { name, players: ids };
        }
        return { name, players: [...new Set(names.map(playerByName))] };
      };
      const dupNames = [v('tA').value.trim().toLowerCase(), v('tB').value.trim().toLowerCase()];
      if (dupNames[0] && dupNames[0] === dupNames[1]) return toast('Give the two teams different names');
      const teams = [mk('A'), mk('B')];
      const dropTmp = () => teams.forEach(t => t.players.forEach(id => { if (DB.players[id]?.tmp) delete DB.players[id]; }));
      if (teams[0].name.toLowerCase() === teams[1].name.toLowerCase()) { dropTmp(); return toast('Give the two teams different names'); }
      const rules = Object.assign({}, DEFAULT_RULES);
      ['overs', 'wideRuns', 'nbRuns', 'maxBowlerOvers'].forEach(k => rules[k] = Math.max(0, +v(k).value || 0));
      rules.overs = Math.max(1, rules.overs);
      ['wideLegal', 'nbLegal', 'freeHit', 'lms', 'consecutive', 'oneTip', 'hitOutside', 'common'].forEach(k => rules[k] = v(k).checked);
      const overlap = teams[0].players.filter(id => teams[1].players.includes(id));
      if (overlap.length && !rules.common) { dropTmp(); return toast(`${nm(overlap[0])} is in both teams – tick “Common player” in Gully rules`); }
      if (overlap.length > 1) { dropTmp(); return toast('Only one common player is allowed'); }
      const conflicts = rules.common ? [] : GS.linkConflicts(teams[0].players, teams[1].players);
      if (conflicts.length && !confirm(`Player links are being overridden:\n\n• ${conflicts.join('\n• ')}\n\nStart anyway? This is recorded in the match audit log.`)) { dropTmp(); return; }
      const toss = { winner: +v('toss').value, dec: v('dec').value };
      if (ui.coin && ui.coin.winner === toss.winner) toss.coin = { caller: ui.coin.caller, call: ui.coin.call, result: ui.coin.result };
      const batFirst = toss.dec === 'bat' ? toss.winner : 1 - toss.winner;
      if (!ui.prefill?.tour) teams.forEach(t => { const i = DB.teams.findIndex(x => x.name.toLowerCase() === t.name.toLowerCase()); const rec = { name: t.name, players: t.players.filter(id => !DB.players[id]?.tmp) }; if (i >= 0) DB.teams[i] = rec; else DB.teams.push(rec); });
      const m = { id: GS.uid(), created: Date.now(), status: 'live', career: v('career').checked, rules, teams, toss, innings: [{ bat: batFirst, overs: rules.overs, events: [] }] };
      if (ui.prefill?.tour) { m.tour = ui.prefill.tour; m.tourName = ui.prefill.tourName; const t = Tour.get(m.tour.id), f = t?.fixtures.find(x => x.id === m.tour.fx); if (f) f.mid = m.id; }
      conflicts.forEach(c => audit(m, { kind: 'override', status: 'pending', text: 'Team selection override – ' + c }));
      DB.matches.push(m); DB.current = m.id; ui.prefill = null; ui.coin = null; ui.coinRot = 0; ui.lastLine = ''; save();
      sayOne('toss', { team: teams[toss.winner].name, opp: teams[1 - toss.winner].name, dec: toss.dec });
      ui.view = 'score'; ui.sheet = { type: 'openers' }; resetSel(); render();
    },
    startInnings: () => {
      const a = document.getElementById('o1').value, b = document.getElementById('o2').value, c = document.getElementById('o3').value;
      if (!a || !c) return toast('Pick striker and bowler');
      if (a === b) return toast('Striker and non-striker must differ');
      if (c === a || c === b) return toast('The common player cannot bat and bowl at the same time');
      push({ t: 'start', striker: a, non: b || null, bowler: c }); ui.sheet = null; render();
    },
    addP: () => { const m = cur(), inn = m.innings[lastIdx(m)]; addPlayer(ui.sheet.type === 'batter' ? inn.bat : 1 - inn.bat); },
    addP2: () => addPlayer(+document.getElementById('addTeam').value),
    pickBat: d => { push({ t: 'bat', id: d.id }); ui.sheet = null; sayOne('newBatter', { p: GS.first(d.id) }); render(); },
    pickBowl: d => { push({ t: 'bowler', id: d.id }); ui.sheet = null; render(); },
    run: d => {
      const n = +d.n;
      if (DB.settings.oneTap && !ui.sel.ex && !ui.sel.w) { ui.sel.runs = n; return commitBall(); }
      ui.sel.runs = ui.sel.runs === n ? null : n; render();
    },
    ex: d => { ui.sel.ex = ui.sel.ex === d.k ? null : d.k; render(); },
    wk: () => { ui.sel.w = !ui.sel.w; render(); },
    next: () => { if (ui.sel.w) { ui.sheet = { type: 'wicket' }; render(); } else commitBall(); },
    wt: d => { ui.sheet.wt = d.k; ui.sheet.f = document.getElementById('fielder')?.value; render(); },
    who: d => { ui.sheet.who = d.id; ui.sheet.f = document.getElementById('fielder')?.value; render(); },
    commitWicket: () => {
      const m = cur(), s = st(m, lastIdx(m)), types = wicketTypes(m, s);
      const type = types.includes(ui.sheet.wt) ? ui.sheet.wt : types[0];
      const out = type === 'Run out' ? (ui.sheet.who || s.striker) : s.striker;
      const fielder = document.getElementById('fielder')?.value || null;
      ui.sheet = null;
      commitBall({ wicket: { type, out, fielder } });
    },
    swap: () => { push({ t: 'swap' }); ui.sheet = null; render(); },
    undo,
    retireMenu: () => { ui.sheet = { type: 'retire' }; render(); },
    retire: d => { push({ t: 'retire', id: d.id, kind: d.k }); ui.sheet = null; render(); },
    changeBowler: () => { ui.sheet = { type: 'bowler', change: true }; render(); },
    endInnings: () => { if (confirm('End this innings now?')) { push({ t: 'end' }); ui.sheet = null; GS.speakLatest(cur()); render(); } },
    toggleSpeak: () => { DB.settings.speak = !DB.settings.speak; save(); ui.sheet = null; if (!DB.settings.speak) TTS.cancel(); toast(DB.settings.speak ? 'Commentary will be spoken after every ball' : 'Commentary voice off'); },
    nextInnings: () => {
      const m = cur(), i = lastIdx(m), s = st(m, i), prev = m.innings[i];
      m.innings.push({ bat: 1 - prev.bat, overs: prev.overs, target: s.runs + 1, events: [], ...(prev.maxW ? { maxW: prev.maxW } : {}) });
      ui.lastLine = ''; save(); ui.sheet = { type: 'openers' }; render();
    },
    superOver: () => {
      const m = cur(), i = lastIdx(m);
      m.innings.push({ bat: m.innings[i].bat, overs: 1, maxW: 2, events: [] });
      ui.lastLine = ''; save(); sayOne('superOver', { team: m.teams[m.innings[i].bat].name }); ui.sheet = { type: 'openers' }; render();
    },
    finish: () => {
      const m = cur();
      if (auditPending(m) && confirm(`${auditPending(m)} manual adjustment(s) have not been reviewed.\n\nOK = review them now\nCancel = finish the match anyway (you can still review from the scorecard)`)) { ui.sheet = { type: 'review' }; return render(); }
      m.result = computeResult(m); m.status = 'done'; m.pom = pom(m); save();
      if (ui.voice.on) X.stopVoice();
      const rated = TeamMaker.autoUpdate(m);
      const tourMsg = Tour.onMatchDone(m);
      save();
      ui.cardId = m.id; ui.view = 'card'; ui.sheet = null; render();
      const fresh = GS.careerAll().ach.filter(a => a.mid === m.id && a.key !== 'pom');
      const msgs = [];
      if (tourMsg) msgs.push(tourMsg);
      if (fresh.length) msgs.push(`🏆 ${fresh.length} achievement${fresh.length > 1 ? 's' : ''}: ${fresh.slice(0, 2).map(a => nm(a.id) + ' – ' + ACH[a.key].name).join(', ')}`);
      if (rated) msgs.push('Team maker ratings updated from form');
      if (msgs.length) toast(msgs.join(' · '));
      if (m.pom) Comm.say([{ key: 'pom', c: { p: nm(m.pom) } }], { interrupt: false });
    },
    abandon: () => { if (!confirm('Abandon and delete this match?')) return; const t = cur()?.tour && Tour.get(cur().tour.id); if (t) t.fixtures.forEach(f => { if (f.mid === DB.current) delete f.mid; }); DB.matches = DB.matches.filter(x => x.id !== DB.current); DB.current = null; save(); ui.sheet = null; ui.view = 'home'; render(); },
    shareMenu: d => { ui.sheet = { type: 'share', id: d.id }; render(); },
    shareTxt: () => { const m = getMatch(ui.sheet.id); ui.sheet = null; render(); copyOrShare(GS.shareText(m), 'Scorecard'); },
    shareComm: () => { const m = getMatch(ui.sheet.id); ui.sheet = null; render(); const txt = m.innings.map((inn, i) => inn.events.length ? `— ${m.teams[inn.bat].name}${isSuper(m, i) ? ' (Super Over)' : ''} —\n` + GS.commentary(m, i).map(c => (c.kind === 'o' ? '' : c.over + '  ') + c.text).join('\n') : '').join('\n\n'); copyOrShare(txt, 'Commentary'); },
    shareImg: async () => { const m = getMatch(ui.sheet?.id || ui.cardId); ui.sheet = null; toast('Preparing image…'); const r = await GS.shareOrDownload(await GS.cardPng(m), fileName(m, 'png'), 'Scorecard'); if (r === 'downloaded') toast('Image saved to downloads'); },
    sharePdf: async () => { const m = getMatch(ui.sheet.id); ui.sheet = null; toast('Preparing PDF…'); const r = await GS.shareOrDownload(await GS.cardPdf(m), fileName(m, 'pdf'), 'Scorecard PDF'); if (r === 'downloaded') toast('PDF saved to downloads'); },
    shareLink: async () => {
      const m = getMatch(ui.sheet?.id) || cur();
      ui.sheet = null; render();
      const link = await GS.snapshotLink(m);
      if (!link) { toast('Set the Public app URL in Settings first'); return; }
      copyOrShare(link, `${m.teams[0].name} vs ${m.teams[1].name} – scorecard`, link);
    },
    shareLinkQR: async () => {
      const m = getMatch(ui.sheet.id), link = await GS.snapshotLink(m);
      if (!link) { ui.sheet = null; toast('Set the Public app URL in Settings first'); return; }
      A.showQR(`${m.teams[0].name} vs ${m.teams[1].name}`, link, 'Scan to open the full scorecard');
    },
    viewImg: async () => { const m = ui.vm; await GS.shareOrDownload(await GS.cardPng(m), fileName(m, 'png'), 'Scorecard'); },
    goLive: () => {
      const m = cur();
      if (GS.liveBase() && GS.appUrl() && !m.live) { m.live = GS.code8(); GS.claimLive(m.live).catch(() => { }); save(); }
      ui.sheet = { type: 'live' }; render();
    },
    shareLiveLink: () => { const m = cur(), l = GS.liveLink(m); copyOrShare(l, `LIVE: ${m.teams[0].name} vs ${m.teams[1].name}`, l); },
    stopLive: () => { const m = cur(); delete m.live; save(); ui.sheet = null; toast('Live sharing stopped'); },
    watchLive: d => { const m = DB.matches.find(x => x.id === d.id); location.hash = `#live=${encodeURIComponent(GS.liveBase())}~${m.live}`; location.reload(); },
    rematch: d => {
      const m = getMatch(d.id);
      ui.prefill = { tA: m.teams[0].name, tB: m.teams[1].name, pA: m.teams[0].players.filter(id => !DB.players[id]?.tmp).map(nm).join('\n'), pB: m.teams[1].players.filter(id => !DB.players[id]?.tmp).map(nm).join('\n'), rules: m.rules, career: m.career };
      ui.sheet = null; ui.view = 'setup'; render();
    },
    delMatch: d => { if (!confirm('Delete this match permanently?')) return; const k = DB.matches.findIndex(x => x.id === d.id); if (k >= 0) DB.matches.splice(k, 1); DB.tours.forEach(t => t.fixtures.forEach(f => { if (f.mid === d.id) delete f.mid; })); save(); ui.view = 'home'; render(); },
    rename: d => { const v = document.getElementById('rename').value.trim(); if (v) { DB.players[d.id].name = v; save(); toast('Renamed'); } },
    merge: d => {
      const from = document.getElementById('mergeFrom').value; if (!from) return;
      if (!confirm(`Merge ${nm(from)} into ${nm(d.id)}? Their careers will be combined.`)) return;
      const swapId = x => x === from ? d.id : x;
      DB.matches.forEach(m => {
        m.teams.forEach(t => t.players = [...new Set(t.players.map(swapId))]);
        m.innings.forEach(inn => inn.events.forEach(e => GS.remapEv(e, x => x === from ? d.id : x)));
        if (m.pom === from) m.pom = d.id;
      });
      DB.teams.forEach(t => t.players = [...new Set(t.players.map(swapId))]);
      DB.tours.forEach(t => { t.teams.forEach(x => x.players = [...new Set(x.players.map(swapId))]); if (t.pos === from) t.pos = d.id; });
      DB.polls.forEach(p => { p.players = [...new Set(p.players.map(swapId))]; if (p.resp[from]) { p.resp[d.id] = p.resp[d.id] || p.resp[from]; delete p.resp[from]; } });
      if (DB.tm) ['avail', 'A', 'B', 'sel'].forEach(k => DB.tm[k] = [...new Set((DB.tm[k] || []).map(swapId))]);
      if (DB.settings.me === from) DB.settings.me = d.id;
      delete DB.players[from]; save(); toast('Players merged'); render();
    },
    setMe: (d, el) => { DB.settings.me = el.value; save(); render(); },
    setFlag: (d, el) => { DB.settings[d.k] = el.checked; save(); },
    setVoiceMode: (d, el) => { DB.settings.voiceConfirm = el.value; save(); toast(el.value === 'ask' ? 'Voice: I will ask “yes / no” before recording' : el.value === 'off' ? 'Voice read-back: on-screen only' : 'Voice: I will read back every ball'); },
    setLH: (d, el) => { DB.players[d.id].lh = el.checked; save(); render(); },
    h2hOpp: (d, el) => { ui.h2hOpp = el.value; render(); },
    saveServer: () => {
      const lu = document.getElementById('liveUrl').value.trim().replace(/\/+$/, '');
      if (lu && !/^https?:\/\//.test(lu)) return toast('Server URL must start with https://');
      DB.settings.liveUrl = lu; DB.settings.appUrl = document.getElementById('appUrl').value.trim();
      save(); toast('Saved');
    },
    cloudPush: async () => { try { toast('Uploading…'); await GS.cloudPush(); toast('Pushed. Sync code: ' + DB.settings.syncCode); } catch (e) { toast(e.message); } },
    cloudPull: async () => {
      const code = prompt('Sync code from the other phone:'); if (!code) return;
      try { const r = await GS.cloudPull(code.trim()); toast(`Merged ${r.addedM} matches, ${r.addedT} tournaments, ${r.addedP} new players`); } catch (e) { toast(e.message); }
    },
    export: async () => {
      const blob = new Blob([JSON.stringify(Object.assign({}, DB, { rev: undefined }), null, 1)], { type: 'application/json' });
      const r = await GS.shareOrDownload(blob, `gully-scorer-backup-${new Date().toISOString().slice(0, 10)}.json`, 'Gully Scorer backup');
      if (r === 'downloaded') toast('Backup saved to downloads');
    },
    importShared: () => { const r = GS.importBundle({ m: ui.vm, p: ui.vp, lh: ui.vlh }); alert(r.addedM ? 'Saved to your matches.' : 'You already have this match.'); A.exitViewer(); },
    exitViewer: () => { clearInterval(ui.vTimer); location.hash = ''; location.reload(); },
    delTeam: d => { DB.teams.splice(+d.i, 1); save(); render(); },
    wipe: () => { if (confirm('Erase ALL matches, players and teams on this phone?')) { localStorage.removeItem(GS.KEY); location.reload(); } },
  });

  // ================= EVENTS =================
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-act]'); if (!el || el.disabled) return;
    if (el.tagName === 'INPUT') return;
    const fn = A[el.dataset.act]; if (fn) { e.preventDefault(); fn(el.dataset, el, e); }
  });
  document.addEventListener('input', e => {
    if (e.target.id && e.target.id.startsWith('adb_r_')) { const t = e.target, prev = +t.dataset.prev, now = +t.value, tr = document.getElementById('ad_runs'); if (tr && Number.isFinite(prev) && Number.isFinite(now) && t.value !== '') { tr.value = (+tr.value || 0) + (now - prev); t.dataset.prev = String(now); } }
    if (e.target.id === 'tA' || e.target.id === 'tB') { const k = e.target.id === 'tA' ? 0 : 1, nmv = e.target.value.trim() || 'Team ' + (k ? 'B' : 'A'); document.querySelectorAll(`#toss option[value="${k}"], #caller option[value="${k}"]`).forEach(o => { o.textContent = nmv; }); }
    if (e.target.type === 'range') { const o = e.target.parentElement.querySelector('output'); if (o) o.textContent = e.target.value + o.textContent.replace(/^[\d.]+/, ''); }
  });
  document.addEventListener('change', e => {
    const el = e.target;
    if (el.dataset.chg && A[el.dataset.chg]) { A[el.dataset.chg](el.dataset, el); return; }
    if (el.dataset.load !== undefined) {
      const t = DB.teams[+el.value]; if (!t) return; const k = el.dataset.load;
      document.getElementById('t' + k).value = t.name; document.getElementById('p' + k).value = t.players.map(nm).join('\n');
    }
    if (el.dataset.imp) {
      const f = el.files[0]; if (!f) return;
      f.text().then(txt => {
        const d = JSON.parse(txt); if (!d.players || !d.matches) throw 0;
        if (el.dataset.imp === 'merge') { const r = GS.mergeData(d); toast(`Merged ${r.addedM} matches, ${r.addedT} tournaments, ${r.addedP} new players`); }
        else if (confirm('Replace ALL data on this phone with the backup?')) { localStorage.setItem(GS.KEY, JSON.stringify(d)); location.reload(); }
      }).catch(() => toast('Not a valid backup file'));
    }
  });
  window.addEventListener('hashchange', () => { if (/^#(view|live|take|takeover|poll)=/.test(location.hash)) location.reload(); });
  window.addEventListener('beforeunload', () => { if (!ui.readonly) localStorage.setItem(GS.KEY, JSON.stringify(DB)); });

  // ================= BOOT =================
  async function boot() {
    const h = location.hash;
    if (await X.bootLinks(h)) return;
    if (h.startsWith('#view=') || h.startsWith('#live=')) {
      ui.readonly = true; ui.view = 'viewer'; render();
      try {
        if (h.startsWith('#view=')) {
          const b = await GS.unpack(h.slice(6)); ui.vm = b.m; ui.vp = b.p; ui.vlh = b.lh || {};
        } else {
          const [base, code] = h.slice(6).split('~'); const baseUrl = decodeURIComponent(base);
          ui.vLive = true;
          const pull = async () => { try { const b = await GS.liveFetch(baseUrl, code); ui.vm = b.m; ui.vp = b.p; ui.vlh = b.lh || {}; ui.vTs = b.ts; ui.viewErr = ''; } catch (e) { if (!ui.vm) ui.viewErr = 'Could not load live match: ' + e.message; } render(); };
          await pull(); ui.vTimer = setInterval(pull, 5000);
        }
      } catch (e) { ui.viewErr = 'This link looks broken or incomplete.'; }
      render(); return;
    }
    if ('serviceWorker' in navigator && /^https?:/.test(location.protocol)) navigator.serviceWorker.register('sw.js').catch(() => { });
    if (cur()?.status === 'live' && !ui.sheet) ui.view = 'score';
    render();
  }
  boot();
})();

