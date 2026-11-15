/* Gully Scorer – scoring engine (pure, replay-based: every state is rebuilt from the event log, so Undo is exact) */
'use strict';
const Engine = (() => {
  const CREDIT = new Set(['Bowled', 'Caught', 'LBW', 'Stumped', 'Hit wicket', 'One tip one hand']);
  const ovs = b => Math.floor(b / 6) + '.' + (b % 6);

  function dismissal(w, nm) {
    const b = nm(w.bowler), f = w.fielder ? nm(w.fielder) : '';
    switch (w.type) {
      case 'Bowled': return 'b ' + b;
      case 'Caught': return w.fielder && w.fielder === w.bowler ? 'c & b ' + b : 'c ' + (f || 'sub') + ' b ' + b;
      case 'One tip one hand': return 'c ' + (f || 'sub') + ' (1T1H) b ' + b;
      case 'LBW': return 'lbw b ' + b;
      case 'Stumped': return 'st ' + (f || 'wk') + ' b ' + b;
      case 'Hit wicket': return 'hit wicket b ' + b;
      case 'Run out': return 'run out' + (f ? ' (' + f + ')' : '');
      case 'Hit outside': return 'hit outside';
      default: return w.type;
    }
  }

  function replay(inn, rules, roster, nm = id => id) {
    const s = {
      runs: 0, wkts: 0, legal: 0, ext: { wd: 0, nb: 0, b: 0, lb: 0 },
      bat: {}, batOrder: [], bowl: {}, bowlOrder: [],
      striker: null, non: null, bowler: null, lastBowler: null,
      fow: [], overs: [[]], freeHit: false, part: { runs: 0, balls: 0 },
      catches: {}, runouts: {}, stumpings: {},
      adj: { count: 0, runs: 0, balls: 0, wkts: 0, batRuns: 0 }, ended: false, done: false, needBatter: false, needBowler: false, solo: false, allOut: false, ballsList: []
    };
    const B = id => (s.bat[id] || (s.bat[id] = { id, r: 0, b: 0, f4: 0, f6: 0, out: null, dismissed: false, retired: false, order: s.batOrder.push(id) }));
    const W = id => (s.bowl[id] || (s.bowl[id] = { id, balls: 0, runs: 0, wkts: 0, maidens: 0, dots: 0, wd: 0, nb: 0, oRuns: 0, oLegal: 0, order: s.bowlOrder.push(id) }));
    const avail = () => roster.filter(id => id !== s.striker && id !== s.non && (!s.bat[id] || (s.bat[id].retired && !s.bat[id].dismissed)));
    const normalize = () => { if (!s.striker && s.non) { s.striker = s.non; s.non = null; } };
    const swap = () => { if (s.striker && s.non) [s.striker, s.non] = [s.non, s.striker]; };
    const removeBatter = id => { if (s.striker === id) s.striker = null; else if (s.non === id) s.non = null; s.part = { runs: 0, balls: 0 }; };

    for (const e of inn.events) {
      if (e.t === 'start') {
        s.striker = e.striker; B(e.striker);
        if (e.non) { s.non = e.non; B(e.non); }
        s.bowler = e.bowler; W(e.bowler);
      } else if (e.t === 'bowler') {
        s.bowler = e.id; const w = W(e.id); w.oRuns = 0; w.oLegal = 0;
      } else if (e.t === 'bat') {
        const b = B(e.id); b.retired = false; b.out = null;
        if (!s.striker) s.striker = e.id; else s.non = e.id;
        s.part = { runs: 0, balls: 0 };
      } else if (e.t === 'swap') {
        swap();
      } else if (e.t === 'retire') {
        const b = B(e.id);
        if (e.kind === 'out') { b.out = 'retired out'; b.dismissed = true; s.wkts++; s.fow.push({ wkt: s.wkts, runs: s.runs, over: ovs(s.legal), id: e.id }); }
        else { b.out = 'retired hurt'; b.retired = true; }
        removeBatter(e.id);
      } else if (e.t === 'end') {
        s.ended = true;
      } else if (e.t === 'adj') {
        // manual adjustment (audited in the UI): additive deltas, so the log stays append-only
        const T = e.team || {}; s.adj.count++;
        s.adj.runs += T.runs || 0; s.adj.wkts += T.wkts || 0; s.adj.balls += T.balls || 0;
        s.runs += T.runs || 0; s.wkts += T.wkts || 0;
        const nb = T.balls || 0;
        if (nb > 0) {
          const before = s.legal, after = before + nb, cross = Math.floor(after / 6) - Math.floor(before / 6);
          s.legal = after; s.overs[s.overs.length - 1].push('⚙');
          if (cross > 0) {
            for (let c = 0; c < cross; c++) s.overs.push((c < cross - 1 || after % 6) ? ['⚙'] : []);
            if (s.bowler) s.lastBowler = s.bowler; s.bowler = null;
          }
        } else if (nb < 0) s.legal = Math.max(0, s.legal + nb);
        (e.bat || []).forEach(x => {
          const b = B(x.p); b.r += x.r || 0; b.b += x.b || 0; b.f4 += x.f4 || 0; b.f6 += x.f6 || 0; s.adj.batRuns += x.r || 0;
          if (x.out && !b.dismissed) { b.out = 'out (manual entry)'; b.dismissed = true; b.retired = false; s.wkts++; s.fow.push({ wkt: s.wkts, runs: s.runs, over: ovs(s.legal), id: x.p }); removeBatter(x.p); }
        });
        (e.bowl || []).forEach(x => { const w = W(x.p); w.balls += x.b || 0; w.runs += x.r || 0; w.wkts += x.w || 0; });
        if (e.crease) {
          const put = id => { const b = B(id); b.retired = false; if (!b.dismissed) b.out = null; return id; };
          if (e.crease.striker) s.striker = put(e.crease.striker);
          if (e.crease.non) s.non = put(e.crease.non);
          if (s.striker && s.striker === s.non) s.non = null;
          s.part = { runs: 0, balls: 0 };
        }
        Object.values(s.bat).forEach(b => { if (!b.dismissed && !b.retired && b.id !== s.striker && b.id !== s.non) { b.retired = true; b.out = 'retired hurt'; } });
      } else if (e.t === 'ball') {
        const st = B(s.striker), bw = W(s.bowler);
        const fh = s.freeHit;
        let total = 0, conceded = 0, legal = true, label = '', batRuns = 0;
        const r = e.runs || 0;
        if (e.extra === 'wd') {
          total = rules.wideRuns + r; conceded = total; s.ext.wd += total; bw.wd++; legal = !!rules.wideLegal;
          label = 'Wd' + (r ? '+' + r : '');
        } else if (e.extra === 'nb') {
          total = rules.nbRuns + r; conceded = total; s.ext.nb += rules.nbRuns; bw.nb++; legal = !!rules.nbLegal;
          st.r += r; st.b++; batRuns = r; if (r === 4) st.f4++; if (r === 6) st.f6++;
          label = 'Nb' + (r ? '+' + r : '');
        } else if (e.extra === 'b' || e.extra === 'lb') {
          total = r; s.ext[e.extra] += r; st.b++;
          label = r + (e.extra === 'b' ? 'B' : 'Lb');
        } else {
          total = r; conceded = r; st.r += r; st.b++; batRuns = r; if (r === 4) st.f4++; if (r === 6) st.f6++;
          label = String(r);
        }
        const partBefore = s.part.runs;
        s.runs += total; s.part.runs += total; bw.runs += conceded; bw.oRuns += conceded;
        if (legal) { s.legal++; bw.balls++; bw.oLegal++; s.part.balls++; if (conceded === 0) bw.dots++; }
        const strikerId = st.id, bowlerId = bw.id, bR = st.r, bB = st.b, partAfter = s.part.runs;
        if (r % 2 === 1) swap();

        let wk = null, outId = null, credit = false, fielder = null;
        if (e.wicket) {
          const w = { ...e.wicket, bowler: s.bowler };
          outId = w.out || s.striker; fielder = w.fielder || null;
          const ob = B(outId);
          ob.out = dismissal(w, nm); ob.dismissed = true; s.wkts++;
          s.fow.push({ wkt: s.wkts, runs: s.runs, over: ovs(s.legal), id: outId });
          if (CREDIT.has(w.type)) { bw.wkts++; credit = true; }
          if (w.fielder && (w.type === 'Caught' || w.type === 'One tip one hand')) s.catches[w.fielder] = (s.catches[w.fielder] || 0) + 1;
          if (w.fielder && w.type === 'Run out') s.runouts[w.fielder] = (s.runouts[w.fielder] || 0) + 1;
          if (w.fielder && w.type === 'Stumped') s.stumpings[w.fielder] = (s.stumpings[w.fielder] || 0) + 1;
          removeBatter(outId);
          label = (label === '0' ? '' : label + '+') + 'W';
          wk = w.type;
        }
        s.overs[s.overs.length - 1].push(label);
        const ball = {
          over: ovs(s.legal), overNo: Math.floor((s.legal - (legal ? 1 : 0)) / 6) + 1, label, total, wk, striker: strikerId, bowler: bowlerId, fh, ex: e.extra || null, batRuns, legal,
          outId, credit, fielder, wg: e.wg || null, bR, bB, partBefore, partAfter, teamBefore: s.runs - total, teamRuns: s.runs, wkts: s.wkts, overEnd: false, bwW: bw.wkts, bwR: bw.runs, bwB: bw.balls, legalSoFar: s.legal
        };
        s.ballsList.push(ball);

        if (e.extra === 'nb' && rules.freeHit) s.freeHit = true;
        else if (legal) s.freeHit = false;

        if (legal && s.legal % 6 === 0) {
          if (bw.oLegal >= 6 && bw.oRuns === 0) { bw.maidens++; ball.maiden = true; }
          ball.overEnd = true; ball.overRuns = bw.oRuns;
          swap(); s.lastBowler = s.bowler; s.bowler = null; s.overs.push([]);
        }
      }
      if (rules.lms && !inn.maxW && avail().length === 0) normalize();
    }

    const inCount = (s.striker ? 1 : 0) + (s.non ? 1 : 0);
    const av = avail().length;
    const need = rules.lms && !inn.maxW ? 1 : 2;
    s.allOut = !!((inn.maxW && s.wkts >= inn.maxW) || (inn.events.length > 0 && inCount + av < need));
    s.solo = !!(rules.lms && !inn.maxW && inCount === 1 && av === 0);
    const targetHit = inn.target && s.runs >= inn.target;
    s.done = s.ended || s.allOut || s.legal >= inn.overs * 6 || !!targetHit;
    s.needBatter = !s.done && inn.events.length > 0 && inCount < 2 && !s.solo && av > 0;
    s.needBowler = !s.done && inn.events.length > 0 && !s.bowler;
    s.oversStr = ovs(s.legal);
    s.crr = s.legal ? (s.runs * 6 / s.legal) : 0;
    if (inn.target) {
      s.need = Math.max(0, inn.target - s.runs);
      s.ballsLeft = Math.max(0, inn.overs * 6 - s.legal);
      s.rrr = s.ballsLeft ? s.need * 6 / s.ballsLeft : 0;
    }
    s.extrasTotal = s.ext.wd + s.ext.nb + s.ext.b + s.ext.lb;
    return s;
  }

  // shot direction → fielding zone. x,y in -1..1, batter at (0,0), y<0 = towards bowler. lh = left-handed
  function zone(wg, lh) {
    if (!wg) return null;
    let [x, y] = wg; if (lh) x = -x;
    const a = Math.atan2(x, -y) * 180 / Math.PI, off = a >= 0, t = Math.abs(a);
    if (t < 25) return off ? 'long off' : 'long on';
    if (t < 65) return off ? 'cover' : 'mid-wicket';
    if (t < 110) return off ? 'point' : 'square leg';
    return off ? 'third man' : 'fine leg';
  }

  return { replay, ovs, dismissal, zone, CREDIT };
})();
if (typeof module !== 'undefined') module.exports = Engine;

