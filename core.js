/* Gully Scorer – core: storage, match helpers, career stats, achievements, rivalries, commentary events, sharing (image/PDF/link), live, handover, polls & sync */
'use strict';
const GS = (() => {
  const KEY = 'gullyscorer.v1';
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const code8 = () => Math.random().toString(36).slice(2, 10);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const DEFAULT_RULES = { overs: 6, wideRuns: 1, nbRuns: 1, wideLegal: false, nbLegal: false, freeHit: true, lms: false, maxBowlerOvers: 0, consecutive: false, oneTip: true, hitOutside: false, common: false };

  let DB;
  try { DB = JSON.parse(localStorage.getItem(KEY)); } catch { DB = null; }
  DB = Object.assign({ players: {}, teams: [], matches: [], tours: [], polls: [], current: null, settings: {}, tm: null, rev: 0, links: [], solos: [], soloCur: null }, DB || {});
  DB.tours = DB.tours || []; DB.polls = DB.polls || []; DB.links = DB.links || []; DB.solos = DB.solos || [];
  DB.settings = Object.assign({ oneTap: false, me: '', liveUrl: '', appUrl: '', syncCode: '', wagon: true, speak: false, voiceAuto: true, voiceConfirm: 'after', voiceSpeak: true, dev: '' }, DB.settings);
  if (!DB.settings.dev) DB.settings.dev = uid();

  const ui = { view: 'home', sel: { runs: null, ex: null, w: false }, sheet: null, cardId: null, playerId: null, statsTab: 'bat', prefill: null, toast: '', readonly: false, vm: null, vp: {}, h2hOpp: '', tourId: null, tourTab: 'fx', pollId: null, lastLine: '' };
  const hooks = [];
  function save() {
    if (ui.readonly) return;
    DB.rev++;
    localStorage.setItem(KEY, JSON.stringify(DB));
    hooks.forEach(h => { try { h(); } catch (e) { console.warn(e); } });
  }
  const everyone = () => Object.values(DB.players).filter(p => !p.tmp);
  const pool = () => everyone().filter(p => !p.del);
  function remapEv(e, f) {
    ['striker', 'non', 'bowler', 'id'].forEach(k => { if (e[k]) e[k] = f(e[k]); });
    if (e.wicket) { if (e.wicket.out) e.wicket.out = f(e.wicket.out); if (e.wicket.fielder) e.wicket.fielder = f(e.wicket.fielder); }
    (e.bat || []).forEach(x => { x.p = f(x.p); }); (e.bowl || []).forEach(x => { x.p = f(x.p); });
    if (e.crease) { if (e.crease.striker) e.crease.striker = f(e.crease.striker); if (e.crease.non) e.crease.non = f(e.crease.non); }
  }
  // keep-apart / keep-together player links: returns human-readable conflicts for a pair of teams
  function linkConflicts(A, B) {
    const inA = new Set(A), inB = new Set(B), out = [];
    (DB.links || []).forEach(g => {
      const ids = g.ids.filter(id => DB.players[id] && (inA.has(id) !== inB.has(id)));
      if (ids.length < 2) return;
      const a = ids.filter(id => inA.has(id)), b = ids.filter(id => inB.has(id)), names = ids.map(nm).join(', ');
      if (g.mode === 'together') { if (a.length && b.length) out.push(`Keep-together players are split: ${names}`); }
      else if (Math.abs(a.length - b.length) > 1) out.push(ids.length === 2 ? `${nm(ids[0])} & ${nm(ids[1])} are in the same team (marked keep-apart)` : `Keep-apart group not spread across both teams: ${names}`);
    });
    return out;
  }
  const nm = id => DB.players[id]?.name || ui.vp[id] || '—';
  const short = id => { const n = nm(id); return n.length > 14 ? n.slice(0, 13) + '…' : n; };
  const first = id => nm(id).split(' ')[0];
  function playerByName(name) {
    name = name.trim(); if (!name) return null;
    const hit = Object.values(DB.players).find(p => p.name.toLowerCase() === name.toLowerCase());
    if (hit) { if (hit.del) delete hit.del; return hit.id; }
    const id = uid(); DB.players[id] = { id, name }; return id;
  }

  const getMatch = id => (ui.vm && ui.vm.id === id) ? ui.vm : DB.matches.find(m => m.id === id);
  const cur = () => DB.matches.find(m => m.id === DB.current);
  const roster = (m, t) => m.teams[t].players;
  const st = (m, i) => Engine.replay(m.innings[i], m.rules, roster(m, m.innings[i].bat), nm);
  const lastIdx = m => m.innings.length - 1;
  const isSuper = (m, i) => i >= 2;
  const f1 = n => (Math.round(n * 100) / 100).toFixed(2);
  const sr = (r, b) => b ? (r * 100 / b).toFixed(1) : '-';
  const econ = (r, b) => b ? (r * 6 / b).toFixed(2) : '-';

  function computeResult(m) {
    const n = m.innings.length, A = m.innings[n - 2], Bn = m.innings[n - 1];
    const sb = st(m, n - 1);
    const so = n > 2 ? ' (Super Over)' : '';
    if (sb.runs >= Bn.target) {
      const tot = Bn.maxW ?? (m.rules.lms ? roster(m, Bn.bat).length : roster(m, Bn.bat).length - 1);
      const left = Math.max(1, tot - sb.wkts);
      return { winner: Bn.bat, by: 'wkts', n: left, text: `${m.teams[Bn.bat].name} won by ${left} wicket${left > 1 ? 's' : ''}${so}` };
    }
    if (sb.runs === Bn.target - 1) return { winner: null, tie: true, text: 'Match tied' + so };
    const by = Bn.target - 1 - sb.runs;
    return { winner: A.bat, by: 'runs', n: by, text: `${m.teams[A.bat].name} won by ${by} run${by > 1 ? 's' : ''}${so}` };
  }

  function pomPoints(m) {
    const pts = {};
    const add = (id, p) => { pts[id] = (pts[id] || 0) + p; };
    m.innings.forEach((inn, i) => {
      if (isSuper(m, i) || !inn.events.length) return;
      const s = st(m, i);
      Object.values(s.bat).forEach(b => add(b.id, b.r + b.f4 + b.f6 * 2 + (b.r >= 50 ? 15 : b.r >= 30 ? 8 : 0)));
      Object.values(s.bowl).forEach(w => add(w.id, w.wkts * 20 + w.maidens * 10 + w.dots));
      Object.entries(s.catches).forEach(([id, c]) => add(id, c * 8));
      Object.entries(s.runouts).forEach(([id, c]) => add(id, c * 8));
      Object.entries(s.stumpings).forEach(([id, c]) => add(id, c * 8));
    });
    const win = m.result?.winner;
    if (win != null) roster(m, win).forEach(id => { if (pts[id] != null) pts[id] += 5; });
    return pts;
  }
  function pom(m) {
    let best = null, bp = -1;
    for (const [id, p] of Object.entries(pomPoints(m))) if (p > bp) { bp = p; best = id; }
    return best;
  }

  // ---------- career, achievements, rivalries (memoised per DB revision) ----------
  const ACH = {
    century: { icon: '💯', name: 'Century', tier: 'Gold', desc: '100 in an innings' },
    fifty: { icon: '🏏', name: 'Big Knock', tier: 'Silver', desc: '50 in an innings' },
    thirty: { icon: '🏏', name: 'Solid Knock', tier: 'Bronze', desc: '30 in an innings' },
    sixer: { icon: '💥', name: 'Six Machine', tier: 'Silver', desc: '3+ sixes in an innings' },
    fivefor: { icon: '🔥', name: 'Five-for', tier: 'Gold', desc: '5 wickets in an innings' },
    threefer: { icon: '🎯', name: 'Three-fer', tier: 'Silver', desc: '3 wickets in an innings' },
    hattrick: { icon: '🎩', name: 'Hat-trick', tier: 'Gold', desc: '3 wickets in 3 balls' },
    maiden: { icon: '🧱', name: 'Maiden', tier: 'Bronze', desc: 'Bowled a maiden over' },
    safehands: { icon: '🧤', name: 'Safe Hands', tier: 'Silver', desc: '3 catches in a match' },
    finisher: { icon: '🏁', name: 'Finisher', tier: 'Silver', desc: 'Not out in a winning chase' },
    pom: { icon: '🏅', name: 'Player of the Match', tier: 'Silver', desc: 'Won Player of the Match' },
    pos: { icon: '🏆', name: 'Player of the Series', tier: 'Gold', desc: 'Best player of a tournament' },
    champ: { icon: '👑', name: 'Champion', tier: 'Gold', desc: 'Won a tournament' },
    golden: { icon: '🦆', name: 'Golden Duck', tier: 'Fun', desc: 'Out first ball' },
    runs100: { icon: '📈', name: '100 career runs', tier: 'Bronze' }, runs250: { icon: '📈', name: '250 career runs', tier: 'Silver' },
    runs500: { icon: '📈', name: '500 career runs', tier: 'Gold' }, runs1000: { icon: '👑', name: '1000 career runs', tier: 'Platinum' },
    wk10: { icon: '🎳', name: '10 career wickets', tier: 'Bronze' }, wk25: { icon: '🎳', name: '25 career wickets', tier: 'Silver' },
    wk50: { icon: '🎳', name: '50 career wickets', tier: 'Gold' },
    m10: { icon: '🗓', name: '10 matches', tier: 'Bronze' }, m25: { icon: '🗓', name: '25 matches', tier: 'Silver' }, m50: { icon: '🗓', name: '50 matches', tier: 'Gold' },
  };
  let memo = { rev: -1 };
  function careerAll() {
    if (memo.rev === DB.rev && memo.data) return memo.data;
    const P = {}, H = {}, ach = [];
    const g = id => (P[id] || (P[id] = { id, m: new Set(), inn: 0, r: 0, b: 0, no: 0, hs: 0, hsNo: false, f4: 0, f6: 0, f30: 0, f50: 0, f100: 0, ducks: 0, bb: 0, br: 0, w: 0, best: [0, 0], ct: 0, ro: 0, st: 0, poms: 0, wins: 0, recent: [], perMatch: [], shots: [] }));
    const earn = (id, key, m, extra) => ach.push({ id, key, d: m.created, mid: m.id, extra });
    const cm = DB.matches.filter(m => m.status === 'done' && m.career).sort((a, b) => a.created - b.created);
    cm.forEach(m => {
      const inMatch = {};
      const pm = id => (inMatch[id] || (inMatch[id] = { r: null, b: 0, out: false, w: null, wr: 0, wb: 0, ct: 0, ro: 0 }));
      m.teams.forEach((t, ti) => t.players.forEach(id => { const p = g(id); p.m.add(m.id); if (m.result?.winner === ti) p.wins++; }));
      if (m.pom) { g(m.pom).poms++; earn(m.pom, 'pom', m); }
      m.innings.forEach((inn, i) => {
        if (isSuper(m, i)) return;
        const s = st(m, i);
        Object.values(s.bat).forEach(b => {
          const p = g(b.id); p.inn++; p.r += b.r; p.b += b.b; p.f4 += b.f4; p.f6 += b.f6;
          if (!b.dismissed) p.no++; if (b.dismissed && b.r === 0) p.ducks++;
          if (b.r > p.hs || (b.r === p.hs && !b.dismissed)) { p.hs = b.r; p.hsNo = !b.dismissed; }
          if (b.r >= 100) { p.f100++; earn(b.id, 'century', m, b.r); } else if (b.r >= 50) { p.f50++; earn(b.id, 'fifty', m, b.r); } else if (b.r >= 30) { p.f30++; earn(b.id, 'thirty', m, b.r); }
          if (b.f6 >= 3) earn(b.id, 'sixer', m, b.f6);
          if (b.dismissed && b.r === 0 && b.b === 1) earn(b.id, 'golden', m);
          if (i === 1 && !b.dismissed && m.result?.winner === inn.bat && b.b > 0) earn(b.id, 'finisher', m, b.r);
          const x = pm(b.id); x.r = (x.r || 0) + b.r; x.b += b.b; x.out = x.out || b.dismissed;
          p.recent.push({ d: m.created, t: `${b.r}${b.dismissed ? '' : '*'} (${b.b})` });
        });
        Object.values(s.bowl).forEach(w => {
          const p = g(w.id); p.bb += w.balls; p.br += w.runs; p.w += w.wkts;
          if (w.wkts > p.best[0] || (w.wkts === p.best[0] && w.runs < p.best[1])) p.best = [w.wkts, w.runs];
          if (w.wkts >= 5) earn(w.id, 'fivefor', m, w.wkts); else if (w.wkts >= 3) earn(w.id, 'threefer', m, w.wkts);
          if (w.maidens) earn(w.id, 'maiden', m, w.maidens);
          const x = pm(w.id); x.w = (x.w || 0) + w.wkts; x.wr += w.runs; x.wb += w.balls;
          p.recent.push({ d: m.created, t: `${w.wkts}/${w.runs} (${Engine.ovs(w.balls)})` });
        });
        Object.entries(s.catches).forEach(([id, c]) => { g(id).ct += c; pm(id).ct += c; });
        Object.entries(s.runouts).forEach(([id, c]) => { g(id).ro += c; pm(id).ro += c; });
        Object.entries(s.stumpings).forEach(([id, c]) => { g(id).st += c; pm(id).ro += c; });
        const seq = {};
        s.ballsList.forEach(x => {
          if (x.legal || x.credit) {
            const q = seq[x.bowler] || (seq[x.bowler] = []);
            q.push(!!x.credit);
            if (q.length >= 3 && q.slice(-3).every(Boolean) && (!q._ht || q.length - q._ht >= 3)) { earn(x.bowler, 'hattrick', m); q._ht = q.length; }
          }
          if (x.wg && x.batRuns > 0) g(x.striker).shots.push({ wg: x.wg, r: x.batRuns });
          if (x.ex === 'wd') return;
          const k = x.striker + '|' + x.bowler;
          const h = H[k] || (H[k] = { bat: x.striker, bowl: x.bowler, balls: 0, runs: 0, outs: 0, ms: new Set() });
          h.balls++; h.runs += x.batRuns; h.ms.add(m.id);
          if (x.credit && x.outId === x.striker) h.outs++;
        });
      });
      Object.entries(inMatch).forEach(([id, x]) => {
        if (x.ct >= 3) earn(id, 'safehands', m, x.ct);
        g(id).perMatch.push({ d: m.created, mid: m.id, r: x.r, b: x.b, out: x.out, w: x.w, wr: x.wr, wb: x.wb, ct: x.ct, ro: x.ro });
      });
      Object.keys(inMatch).concat(m.teams.flatMap(t => t.players)).filter((v, i, a) => a.indexOf(v) === i).forEach(id => {
        const p = g(id), mk = p._mk || (p._mk = {});
        [[100, 'runs100'], [250, 'runs250'], [500, 'runs500'], [1000, 'runs1000']].forEach(([n, k]) => { if (p.r >= n && !mk[k]) { mk[k] = 1; earn(id, k, m); } });
        [[10, 'wk10'], [25, 'wk25'], [50, 'wk50']].forEach(([n, k]) => { if (p.w >= n && !mk[k]) { mk[k] = 1; earn(id, k, m); } });
        [[10, 'm10'], [25, 'm25'], [50, 'm50']].forEach(([n, k]) => { if (p.m.size >= n && !mk[k]) { mk[k] = 1; earn(id, k, m); } });
      });
    });
    DB.tours.filter(t => t.done).forEach(t => {
      const fake = { created: t.doneAt || t.created, id: t.id };
      if (t.pos && DB.players[t.pos]) earn(t.pos, 'pos', fake, t.name);
      if (t.champ != null) t.teams[t.champ]?.players.forEach(id => earn(id, 'champ', fake, t.name));
    });
    memo = { rev: DB.rev, data: { P, H, ach, cm } };
    return memo.data;
  }
  const career = () => careerAll().P;

  function h2hFor(bat, bowl) { return careerAll().H[bat + '|' + bowl] || null; }
  function batVsOthers(bat, exceptBowl) {
    let r = 0, b = 0;
    Object.values(careerAll().H).forEach(h => { if (h.bat === bat && h.bowl !== exceptBowl) { r += h.runs; b += h.balls; } });
    return { r, b };
  }
  function topRivalry() {
    const list = Object.values(careerAll().H).filter(h => h.outs >= 2 && DB.players[h.bat] && DB.players[h.bowl]).sort((a, b) => b.outs - a.outs || a.runs / a.balls - b.runs / b.balls);
    return list[0] || null;
  }
  function weekStart(t) { const d = new Date(t); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.getTime(); }
  function streak() {
    const weeks = new Set(DB.matches.filter(m => m.status === 'done').map(m => weekStart(m.created)));
    const W = 7 * 864e5; let w = weekStart(Date.now()); const thisWeek = weeks.has(w);
    if (!thisWeek) w -= W;
    let n = 0; while (weeks.has(w)) { n++; w -= W; }
    return { n, thisWeek };
  }
  function teamForm(name) {
    return DB.matches.filter(m => m.status === 'done' && m.result).filter(m => m.teams.some(t => t.name.toLowerCase() === name.toLowerCase()))
      .sort((a, b) => a.created - b.created).slice(-5).map(m => {
        const ti = m.teams.findIndex(t => t.name.toLowerCase() === name.toLowerCase());
        return m.result.tie ? 'T' : m.result.winner === ti ? 'W' : 'L';
      });
  }
  function milestones() {
    const out = [];
    Object.values(career()).forEach(p => {
      if (!DB.players[p.id]) return;
      const nr = [50, 100, 250, 500, 1000, 2000, 5000].find(n => n > p.r);
      if (nr && p.r > 0 && nr - p.r <= 15) out.push({ id: p.id, text: `${p.r} career runs`, sub: `${nr - p.r} runs away from ${nr}`, gap: (nr - p.r) / nr });
      const nw = [10, 25, 50, 100].find(n => n > p.w);
      if (nw && p.w > 0 && nw - p.w <= 3) out.push({ id: p.id, text: `${p.w} career wickets`, sub: `${nw - p.w} wicket${nw - p.w > 1 ? 's' : ''} to ${nw}`, gap: (nw - p.w) / nw });
    });
    return out.sort((a, b) => a.gap - b.gap);
  }

  // ---------- commentary events ----------
  const WK = { Bowled: 'bowled', Caught: 'caught', LBW: 'lbw', 'Run out': 'runout', Stumped: 'stumped', 'Hit wicket': 'hitwicket', 'One tip one hand': 'onetip', 'Hit outside': 'hitoutside' };
  const RK = r => ['dot', 'r1', 'r2', 'r3', 'r4', 'r5', 'r6'][Math.min(6, r)] || 'r6';
  /** innings → [{over,label,kind,ev:[{key,c}]}] – language-neutral events, rendered by Comm */
  function ballItems(m, i) {
    const inn = m.innings[i]; if (!inn?.events.length) return [];
    const s = st(m, i), out = [];
    const lh = id => !!(DB.players[id]?.lh || ui.vlh?.[id]);
    const team = m.teams[inn.bat].name, opp = m.teams[1 - inn.bat].name;
    if (i === 0) out.push({ over: '', label: '', kind: 'o', ev: [{ key: 'toss', c: { team: m.teams[m.toss.winner].name, opp: m.teams[1 - m.toss.winner].name, dec: m.toss.dec } }] });
    if (i === 2) out.push({ over: '', label: '', kind: 'o', ev: [{ key: 'superOver', c: { team, opp } }] });
    const seq = {};
    s.ballsList.forEach(x => {
      const c = { bt: first(x.striker), bw: first(x.bowler), f: x.fielder ? first(x.fielder) : '', zone: Engine.zone(x.wg, lh(x.striker)) || '', r: x.total, out: x.outId ? first(x.outId) : '', team, opp };
      const ev = [];
      if (x.wk) {
        const key = x.wk === 'Caught' && x.fielder && x.fielder === x.bowler ? 'cnb' : (WK[x.wk] || 'bowled');
        if (key === 'stumped') c.keeper = true;
        if (x.ex === 'nb' || x.ex === 'wd') ev.push({ key: x.ex, c });
        ev.push({ key, c });
      } else if (x.ex === 'wd') ev.push({ key: 'wd', c });
      else if (x.ex === 'nb') { ev.push({ key: 'nb', c }); if (x.batRuns) ev.push({ key: RK(x.batRuns), c }); }
      else if (x.ex === 'b' || x.ex === 'lb') ev.push({ key: x.ex === 'b' ? 'bye' : 'lb', c });
      else ev.push({ key: RK(x.batRuns), c });
      if (x.ex === 'nb' && m.rules.freeHit && !x.wk) ev.push({ key: 'freehit', c });
      if (x.bR >= 100 && x.bR - x.batRuns < 100) ev.push({ key: 'hundred', c: { ...c, n: x.bR, b: x.bB } });
      else if (x.bR >= 50 && x.bR - x.batRuns < 50) ev.push({ key: 'fifty', c: { ...c, n: x.bR, b: x.bB } });
      [50, 100].forEach(n => { if (x.partAfter >= n && x.partBefore < n && !x.wk) ev.push({ key: 'pship', c: { ...c, n } }); });
      [50, 100, 150, 200].forEach(n => { if (x.teamRuns >= n && x.teamBefore < n) ev.push({ key: 'teamN', c: { ...c, n } }); });
      if (x.legal || x.credit) {
        const q = seq[x.bowler] || (seq[x.bowler] = []); q.push(!!x.credit);
        if (x.credit && q.length >= 3 && q.slice(-3).every(Boolean) && (!q._ht || q.length - q._ht >= 3)) { ev.push({ key: 'hattrick', c }); q._ht = q.length; }
      }
      if (x.credit && (x.bwW === 3 || x.bwW === 5)) ev.push({ key: 'haul', c: { ...c, n: x.bwW } });
      out.push({ over: x.over, label: x.label, kind: x.wk ? 'w' : x.batRuns >= 4 ? 'b' : x.ex ? 'x' : '', ev });
      if (x.overEnd) {
        const o = [];
        if (x.maiden) o.push({ key: 'maiden', c });
        o.push({ key: 'overEnd', c: { team, opp, o: x.overNo, score: [x.teamRuns, x.wkts], r: x.overRuns } });
        const left = inn.overs * 6 - x.legalSoFar;
        if (inn.target && x.teamRuns < inn.target && left > 0) o.push({ key: 'equation', c: { team, n: inn.target - x.teamRuns, b: left } });
        out.push({ over: x.over, label: '', kind: 'o', ev: o });
      }
    });
    if (s.done) {
      const o = [];
      if (i % 2 === 0) o.push({ key: 'inningsBreak', c: { team, opp, score: [s.runs, s.wkts], n: s.runs + 1 } });
      else {
        const last = i === lastIdx(m), r = last ? (m.result || computeResult(m)) : { tie: true };
        if (r.tie) o.push({ key: 'tie', c: { team, opp } });
        else {
          const wt = m.teams[r.winner].name, lt = m.teams[1 - r.winner].name;
          o.push({ key: r.by === 'wkts' ? 'winChase' : 'winDefend', c: { team: wt, opp: lt, n: r.n } });
        }
        if (last && m.pom) o.push({ key: 'pom', c: { p: nm(m.pom) } });
      }
      out.push({ over: s.oversStr, label: '', kind: 'o', ev: o });
    }
    return out;
  }
  function commentary(m, i) {
    return ballItems(m, i).map((it, k) => ({ ...it, text: it.ev.map((e, j) => Comm.text(e.key, e.c, `${m.id}:${i}:${k}:${j}`)).filter(Boolean).join(' ') }));
  }
  function lastCommentary(m) { const c = commentary(m, lastIdx(m)); return c.filter(x => x.kind !== 'o').slice(-1)[0]?.text || ''; }
  /** speak the newest ball (plus over / innings summaries that follow it) */
  function speakLatest(m) {
    if (!DB.settings.speak) return;
    const i = lastIdx(m), items = ballItems(m, i); if (!items.length) return;
    let k = items.length - 1; const tail = [];
    while (k >= 0 && items[k].kind === 'o' && items[k].over) { tail.unshift(items[k]); k--; }
    const evs = Comm.filterEvs((k >= 0 && items[k].over ? items[k].ev : []).concat(...tail.map(t => t.ev)));
    const s = st(m, i);
    const spoken = Comm.say(evs, { score: s.done ? null : { team: m.teams[m.innings[i].bat].name, runs: s.runs, wkts: s.wkts } });
    if (spoken[0]) ui.lastLine = spoken.map(x => x.text).join(' ');
  }

  // ---------- compression + links ----------
  const b64u = bytes => { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
  const unb64u = str => { const s = atob(str.replace(/-/g, '+').replace(/_/g, '/')); const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; };
  async function pack(obj) {
    const raw = new TextEncoder().encode(JSON.stringify(obj));
    if (typeof CompressionStream !== 'undefined') {
      const buf = await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer();
      return 'z' + b64u(new Uint8Array(buf));
    }
    return 'j' + b64u(raw);
  }
  async function unpack(str) {
    const kind = str[0], bytes = unb64u(str.slice(1));
    let raw = bytes;
    if (kind === 'z') raw = new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
    return JSON.parse(new TextDecoder().decode(raw));
  }
  function matchBundle(m) {
    const ids = new Set(m.teams.flatMap(t => t.players));
    const p = {}; ids.forEach(id => p[id] = nm(id));
    const lh = {}; ids.forEach(id => { if (DB.players[id]?.lh) lh[id] = 1; });
    return { m, p, lh };
  }
  function appUrl() {
    if (DB.settings.appUrl) return DB.settings.appUrl.replace(/#.*$/, '');
    return /^https?:/.test(location.protocol) ? location.href.replace(/#.*$/, '') : '';
  }
  async function snapshotLink(m) { const u = appUrl(); return u ? `${u}#view=${await pack(matchBundle(m))}` : ''; }
  async function handoverLink(m) { const u = appUrl(); return u ? `${u}#take=${await pack(matchBundle(m))}` : ''; }
  const liveBase = () => (DB.settings.liveUrl || '').trim().replace(/\/+$/, '');
  const liveLink = m => { const u = appUrl(); return u && m.live ? `${u}#live=${encodeURIComponent(liveBase())}~${m.live}` : ''; };
  const takeoverLink = m => { const u = appUrl(); return u && m.live ? `${u}#takeover=${encodeURIComponent(liveBase())}~${m.live}` : ''; };
  const pollLink = p => { const u = appUrl(); return u && p.code && liveBase() ? `${u}#poll=${encodeURIComponent(liveBase())}~${p.code}` : ''; };

  async function jget(url) { const r = await fetch(url + (url.includes('?') ? '&' : '?') + 'ts=' + Date.now(), { cache: 'no-store' }); if (!r.ok) throw new Error('Server said ' + r.status); return r.json(); }
  async function jput(url, body) { const r = await fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); if (!r.ok) throw new Error('Server said ' + r.status); return r.json().catch(() => null); }

  let liveTimer = null, liveBusy = false, liveDirty = false; ui.liveState = '';
  async function liveSend() {
    const m = cur(); if (!m || !m.live || !liveBase() || m.status === 'handed') return;
    if (liveBusy) { liveDirty = true; return; }
    liveBusy = true; liveDirty = false;
    try {
      const owner = await jget(`${liveBase()}/gully/${m.live}/owner.json`).catch(() => null);
      if (owner && owner !== DB.settings.dev) {
        m.status = 'handed'; m.handedAt = Date.now(); DB.current = null; save();
        ui.view = 'home'; ui.sheet = null; GS.toast?.('Scoring has moved to another phone – this phone stopped scoring.'); GS.render();
      } else {
        const d = await pack(matchBundle(m));
        await jput(`${liveBase()}/gully/${m.live}.json`, { d, ts: Date.now(), owner: DB.settings.dev });
        ui.liveState = 'sent';
      }
    } catch { ui.liveState = 'offline – will resend on next ball'; }
    liveBusy = false;
    if (liveDirty) liveSend();
  }
  function livePush() { clearTimeout(liveTimer); liveTimer = setTimeout(liveSend, 400); }
  hooks.push(livePush);
  async function liveFetch(base, code) {
    const j = await jget(`${base}/gully/${code}.json`);
    if (!j || !j.d) throw new Error('No live match with this code');
    return Object.assign(await unpack(j.d), { ts: j.ts, owner: j.owner });
  }

  // ---------- merge / import ----------
  function mapPlayers(players) {
    const map = {}; let added = 0;
    Object.values(players || {}).forEach(p => {
      if (DB.players[p.id]) { map[p.id] = p.id; return; }
      const same = Object.values(DB.players).find(x => x.name.toLowerCase() === p.name.toLowerCase());
      if (same) map[p.id] = same.id; else { DB.players[p.id] = { ...p }; map[p.id] = p.id; added++; }
    });
    return { map, added };
  }
  function remapMatch(m, mp) {
    const c = JSON.parse(JSON.stringify(m));
    c.teams.forEach(t => t.players = [...new Set(t.players.map(mp))]);
    c.innings.forEach(inn => inn.events.forEach(e => remapEv(e, mp)));
    if (c.pom) c.pom = mp(c.pom);
    return c;
  }
  function mergeData(other) {
    const { map, added } = mapPlayers(other.players); let addedM = 0, addedT = 0;
    const mp = id => id && (map[id] || id);
    (other.matches || []).forEach(m => {
      if (DB.matches.some(x => x.id === m.id)) return;
      const c = remapMatch(m, mp);
      if (c.status === 'live' || c.status === 'handed') c.status = 'done';
      delete c.live;
      DB.matches.push(c); addedM++;
    });
    (other.teams || []).forEach(t => { if (!DB.teams.some(x => x.name.toLowerCase() === t.name.toLowerCase())) DB.teams.push({ name: t.name, players: t.players.map(mp) }); });
    (other.tours || []).forEach(t => {
      if (DB.tours.some(x => x.id === t.id)) return;
      const c = JSON.parse(JSON.stringify(t)); c.teams.forEach(tt => tt.players = tt.players.map(mp)); if (c.pos) c.pos = mp(c.pos);
      DB.tours.push(c); addedT++;
    });
    (other.solos || []).forEach(s0 => {
      if (DB.solos.some(x => x.id === s0.id)) return;
      const c = JSON.parse(JSON.stringify(s0)); c.players = c.players.map(mp);
      c.rounds.forEach(r => { r.players = r.players.map(mp); r.order = r.order.map(mp); const nt = {}; Object.entries(r.turns || {}).forEach(([k, v]) => { nt[mp(k)] = v; }); r.turns = nt; });
      (c.audit || []).forEach(a => { if (a.pid) a.pid = mp(a.pid); });
      if (c.status === 'live') c.status = 'done';
      DB.solos.push(c);
    });
    (other.links || []).forEach(g => {
      const ids = (g.ids || []).map(mp).filter(id => DB.players[id]), key = [...ids].sort().join(',');
      if (ids.length > 1 && !DB.links.some(x => x.mode === g.mode && [...x.ids].sort().join(',') === key)) DB.links.push({ id: g.id || uid(), mode: g.mode, ids });
    });
    DB.matches.sort((a, b) => a.created - b.created);
    save();
    return { addedP: added, addedM, addedT };
  }
  function bundlePlayers(b) { const players = {}; Object.entries(b.p).forEach(([id, name]) => players[id] = { id, name, ...(b.lh?.[id] ? { lh: true } : {}) }); return players; }
  function importBundle(b) {
    const m = JSON.parse(JSON.stringify(b.m)); delete m.live;
    return mergeData({ players: bundlePlayers(b), matches: [m], teams: [] });
  }
  function takeMatch(b, liveCode) {
    const { map } = mapPlayers(bundlePlayers(b));
    const c = remapMatch(b.m, id => id && (map[id] || id));
    c.status = 'live'; delete c.handedAt;
    if (liveCode) c.live = liveCode; else delete c.live;
    const k = DB.matches.findIndex(x => x.id === c.id);
    if (k >= 0) DB.matches[k] = c; else DB.matches.push(c);
    DB.current = c.id; save();
    return c;
  }
  async function claimLive(code) { await jput(`${liveBase()}/gully/${code}/owner.json`, DB.settings.dev); }

  async function cloudPush() {
    if (!liveBase()) throw new Error('Set the live/sync server URL in Settings');
    if (!DB.settings.syncCode) { DB.settings.syncCode = code8(); save(); }
    const d = await pack({ players: DB.players, matches: DB.matches.filter(m => m.status === 'done'), teams: DB.teams, tours: DB.tours });
    await jput(`${liveBase()}/gully-sync/${DB.settings.syncCode}.json`, { d, ts: Date.now() });
  }
  async function cloudPull(code) {
    const j = await jget(`${liveBase()}/gully-sync/${code}.json`);
    if (!j?.d) throw new Error('Nothing found for this sync code');
    return mergeData(await unpack(j.d));
  }

  async function pollPublish(p) {
    if (!p.code) p.code = code8();
    const players = {}; p.players.forEach(id => players[id] = nm(id));
    await jput(`${liveBase()}/gully-poll/${p.code}/info.json`, { title: p.title, when: p.when, where: p.where, players, ts: Date.now() });
    save();
  }
  async function pollFetchResponses(p) {
    const r = await jget(`${liveBase()}/gully-poll/${p.code}/r.json`) || {};
    let n = 0;
    Object.values(r).forEach(x => {
      if (!x || !x.s) return;
      let id = x.pid && DB.players[x.pid] ? x.pid : null;
      if (!id && x.name) { id = playerByName(x.name); if (!p.players.includes(id)) p.players.push(id); }
      if (id && (!p.ts?.[id] || p.ts[id] < x.ts)) { p.resp[id] = x.s; (p.ts || (p.ts = {}))[id] = x.ts; n++; }
    });
    save(); return n;
  }

  // ---------- scorecard image + PDF ----------
  function drawCard(m) {
    const W = 1080, P = 40, cv = document.createElement('canvas'), breaks = [];
    const run = (ctx) => {
      let y = 0;
      const T = (t, x, yy, font, color, align = 'left') => { if (!ctx) return; ctx.font = font; ctx.fillStyle = color; ctx.textAlign = align; ctx.fillText(t, x, yy); };
      const fit = (t, max, font) => { if (!ctx) return t; ctx.font = font; if (ctx.measureText(t).width <= max) return t; while (t.length > 1 && ctx.measureText(t + '…').width > max) t = t.slice(0, -1); return t + '…'; };
      const wrap = (t, max, font) => { const mc = cv.getContext('2d'); mc.font = font; const words = t.split(' '), lines = []; let l = ''; words.forEach(w => { const tt = l ? l + ' ' + w : w; if (mc.measureText(tt).width > max && l) { lines.push(l); l = w; } else l = tt; }); if (l) lines.push(l); return lines; };
      if (ctx) { const g = ctx.createLinearGradient(0, 0, W, 260); g.addColorStop(0, '#0f7a3d'); g.addColorStop(1, '#0b5e2f'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, 270); }
      T('GULLY SCORER' + (m.tourName ? ' · ' + m.tourName : ''), P, 50, '600 26px sans-serif', 'rgba(255,255,255,.8)');
      T(new Date(m.created).toLocaleDateString() + ` · ${m.rules.overs} overs`, W - P, 50, '24px sans-serif', 'rgba(255,255,255,.8)', 'right');
      T(fit(`${m.teams[0].name} vs ${m.teams[1].name}`, W - 2 * P, 'bold 46px sans-serif'), P, 115, 'bold 46px sans-serif', '#fff');
      T(m.result?.text || 'In progress', P, 175, 'bold 36px sans-serif', '#ffd54a');
      if (m.pom) T('★ Player of the Match: ' + nm(m.pom), P, 230, '30px sans-serif', '#fff');
      y = 300; breaks.push(y);
      m.innings.forEach((inn, i) => {
        if (!inn.events.length) return;
        const s = st(m, i);
        if (ctx) { ctx.fillStyle = '#e8f3ec'; ctx.fillRect(0, y, W, 70); }
        T(fit(m.teams[inn.bat].name + (isSuper(m, i) ? ' (Super Over)' : ''), 640, 'bold 34px sans-serif'), P, y + 47, 'bold 34px sans-serif', '#0b5e2f');
        T(`${s.runs}/${s.wkts} (${s.oversStr})`, W - P, y + 47, 'bold 34px sans-serif', '#0b5e2f', 'right');
        y += 110;
        const cols = [[640, 'R'], [730, 'B'], [810, '4s'], [890, '6s'], [W - P, 'SR']];
        T('Batter', P, y, '600 22px sans-serif', '#66756c'); cols.forEach(([x, l]) => T(l, x, y, '600 22px sans-serif', '#66756c', 'right')); y += 14; if (ctx) { ctx.fillStyle = '#dfe7e2'; ctx.fillRect(P, y, W - 2 * P, 2); } y += 40;
        s.batOrder.forEach(id => {
          const b = s.bat[id];
          T(fit(nm(id), 520, 'bold 30px sans-serif'), P, y, 'bold 30px sans-serif', '#14201a');
          [b.r, b.b, b.f4, b.f6, sr(b.r, b.b)].forEach((v, k) => T(String(v), cols[k][0], y, (k ? '' : 'bold ') + '30px sans-serif', '#14201a', 'right'));
          T(fit(b.out || 'not out', 560, '22px sans-serif'), P, y + 30, '22px sans-serif', '#66756c');
          y += 74; breaks.push(y - 34);
        });
        T(`Extras ${s.extrasTotal} (wd ${s.ext.wd}, nb ${s.ext.nb}, b ${s.ext.b}, lb ${s.ext.lb})`, P, y, '24px sans-serif', '#14201a'); y += 38;
        if (s.fow.length) { wrap('Fall of wickets: ' + s.fow.map(f => `${f.runs}-${f.wkt} (${nm(f.id)}, ${f.over})`).join(', '), W - 2 * P, '22px sans-serif').forEach(l => { T(l, P, y, '22px sans-serif', '#66756c'); y += 32; }); }
        y += 30; breaks.push(y - 30);
        const bc = [[640, 'O'], [730, 'M'], [810, 'R'], [890, 'W'], [W - P, 'Eco']];
        T('Bowler', P, y, '600 22px sans-serif', '#66756c'); bc.forEach(([x, l]) => T(l, x, y, '600 22px sans-serif', '#66756c', 'right')); y += 14; if (ctx) { ctx.fillStyle = '#dfe7e2'; ctx.fillRect(P, y, W - 2 * P, 2); } y += 40;
        s.bowlOrder.forEach(id => {
          const w = s.bowl[id];
          T(fit(nm(id), 520, '30px sans-serif'), P, y, '30px sans-serif', '#14201a');
          [Engine.ovs(w.balls), w.maidens, w.runs, w.wkts, econ(w.runs, w.balls)].forEach((v, k) => T(String(v), bc[k][0], y, (k === 3 ? 'bold ' : '') + '30px sans-serif', '#14201a', 'right'));
          y += 50; breaks.push(y - 34);
        });
        y += 10;
        s.overs.filter(o => o.length).forEach((o, k) => {
          T('Ov ' + (k + 1), P, y + 8, '22px sans-serif', '#66756c');
          let x = P + 90;
          o.forEach(l => {
            const wdt = Math.max(48, 18 * l.length + 16);
            if (x + wdt > W - P) { x = P + 90; y += 58; }
            const c = /(^|\+)W$/.test(l) ? '#d32f2f' : l === '4' ? '#1565c0' : l === '6' ? '#6a1b9a' : /Wd|Nb|B|Lb/.test(l) ? '#f9c80e' : '#eef3f0';
            const fg = ['#d32f2f', '#1565c0', '#6a1b9a'].includes(c) ? '#fff' : '#222';
            if (ctx) { ctx.fillStyle = c; ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y - 20, wdt, 48, 24); else ctx.rect(x, y - 20, wdt, 48); ctx.fill(); }
            T(l === '0' ? '•' : l, x + wdt / 2, y + 12, 'bold 22px sans-serif', fg, 'center');
            x += wdt + 8;
          });
          y += 62; breaks.push(y - 34);
        });
        y += 30; breaks.push(y);
      });
      T('Scored ball-by-ball with Gully Scorer', W / 2, y + 10, '22px sans-serif', '#93a59a', 'center');
      return y + 40;
    };
    const H = run(null);
    cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
    breaks.length = 0; run(ctx);
    return { canvas: cv, breaks: [...new Set(breaks)].sort((a, b) => a - b) };
  }
  const canvasBlob = (cv, type = 'image/png', q) => new Promise(r => cv.toBlob(r, type, q));
  async function cardPng(m) { return canvasBlob(drawCard(m).canvas); }
  async function cardPdf(m) {
    const { canvas, breaks } = drawCard(m);
    const pageH = Math.round(canvas.width * 842 / 595);
    const pages = []; let y0 = 0;
    while (y0 < canvas.height - 1) {
      let y1 = Math.min(canvas.height, y0 + pageH);
      if (y1 < canvas.height) { const b = breaks.filter(b => b > y0 + 200 && b <= y1).pop(); if (b) y1 = b; }
      const c = document.createElement('canvas'); c.width = canvas.width; c.height = y1 - y0;
      const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(canvas, 0, -y0);
      const jpg = new Uint8Array(await (await canvasBlob(c, 'image/jpeg', 0.9)).arrayBuffer());
      pages.push({ jpg, w: c.width, h: c.height });
      y0 = y1;
    }
    return new Blob([buildPdf(pages)], { type: 'application/pdf' });
  }
  function buildPdf(pages) {
    const enc = new TextEncoder(), chunks = [], offs = []; let off = 0;
    const add = x => { const b = typeof x === 'string' ? enc.encode(x) : x; chunks.push(b); off += b.length; };
    const obj = (id, body) => { offs[id] = off; add(`${id} 0 obj\n${body}\nendobj\n`); };
    add('%PDF-1.4\n');
    const n = pages.length, kids = pages.map((_, i) => `${3 + 3 * i} 0 R`).join(' ');
    obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
    obj(2, `<< /Type /Pages /Kids [${kids}] /Count ${n} >>`);
    pages.forEach((p, i) => {
      const pid = 3 + 3 * i, iid = pid + 1, cid = pid + 2, pw = 595, ph = +(p.h * 595 / p.w).toFixed(2);
      obj(pid, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pw} ${ph}] /Resources << /XObject << /Im${i} ${iid} 0 R >> >> /Contents ${cid} 0 R >>`);
      offs[iid] = off;
      add(`${iid} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${p.w} /Height ${p.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpg.length} >>\nstream\n`);
      add(p.jpg); add('\nendstream\nendobj\n');
      const cs = `q ${pw} 0 0 ${ph} 0 0 cm /Im${i} Do Q`;
      obj(cid, `<< /Length ${cs.length} >>\nstream\n${cs}\nendstream`);
    });
    const total = 3 + 3 * n, xref = off;
    let x = `xref\n0 ${total}\n0000000000 65535 f \n`;
    for (let i = 1; i < total; i++) x += String(offs[i]).padStart(10, '0') + ' 00000 n \n';
    add(x + `trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
    const out = new Uint8Array(off); let p = 0; chunks.forEach(c => { out.set(c, p); p += c.length; });
    return out;
  }
  async function shareOrDownload(blob, name, title) {
    const file = new File([blob], name, { type: blob.type });
    try { if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title }); return 'shared'; } } catch (e) { if (e.name === 'AbortError') return 'cancelled'; }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    return 'downloaded';
  }
  function shareText(m) {
    const L = [`🏏 ${m.teams[0].name} vs ${m.teams[1].name}${m.tourName ? ' · ' + m.tourName : ''}`];
    m.innings.forEach((inn, i) => {
      if (!inn.events.length) return;
      const s = st(m, i);
      L.push(`\n${m.teams[inn.bat].name}${isSuper(m, i) ? ' (Super Over)' : ''}: ${s.runs}/${s.wkts} (${s.oversStr} ov)`);
      Object.values(s.bat).sort((a, b) => b.r - a.r).slice(0, 3).forEach(b => L.push(`  ${nm(b.id)} ${b.r}${b.dismissed ? '' : '*'} (${b.b})`));
      Object.values(s.bowl).sort((a, b) => b.wkts - a.wkts || a.runs - b.runs).slice(0, 2).forEach(w => L.push(`  ${nm(w.id)} ${w.wkts}/${w.runs} (${Engine.ovs(w.balls)})`));
    });
    if (m.result) L.push(`\n${m.result.text}`);
    const nAdj = (m.audit || []).filter(a => a.kind === 'adj' && !['undone', 'reverted'].includes(a.status)).length;
    if (nAdj) L.push(`⚠ Includes ${nAdj} manual score adjustment${nAdj > 1 ? 's' : ''}`);
    if (m.pom) L.push(`🏅 Player of the Match: ${nm(m.pom)}`);
    return L.join('\n');
  }

  return {
    KEY, uid, code8, esc, DEFAULT_RULES, DB, ui, save, hooks, pool, everyone, remapEv, linkConflicts, nm, short, first, playerByName, getMatch, cur, roster, st, lastIdx, isSuper, f1, sr, econ,
    computeResult, pom, pomPoints, ACH, careerAll, career, h2hFor, batVsOthers, topRivalry, streak, teamForm, milestones, ballItems, commentary, lastCommentary, speakLatest,
    pack, unpack, matchBundle, appUrl, snapshotLink, handoverLink, liveBase, liveLink, takeoverLink, pollLink, livePush, liveFetch, jget, jput,
    mergeData, importBundle, takeMatch, claimLive, cloudPush, cloudPull, pollPublish, pollFetchResponses,
    drawCard, cardPng, cardPdf, shareOrDownload, shareText,
    V: {}, S: {}, A: {}, render: () => { }, toast: () => { }
  };
})();

