/* Gully Scorer – extras: voice scoring, wagon wheel, QR sheets, squad availability polls, phone handover */
'use strict';
const X = (() => {
  const { DB, ui, esc, nm, short, save, V, S, A } = GS;

  // ================= VOICE INPUT =================
  const NUM = { zero: 0, dot: 0, nil: 0, nothing: 0, one: 1, won: 1, single: 1, singles: 1, two: 2, double: 2, couple: 2, three: 3, triple: 3, four: 4, for: 4, boundary: 4, five: 5, six: 6, sixer: 6, maximum: 6, sex: 6 };
  function parse(text) {
    let t = ' ' + String(text).toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim() + ' ';
    if (/ (undo|cancel|mistake|go back) /.test(t)) return { cmd: 'undo' };
    if (/ (swap|change strike|switch strike|rotate strike) /.test(t)) return { cmd: 'swap' };
    const r = { runs: null, ex: null, w: false, wt: null };
    if (/ one tip one hand | one tip | 1 tip /.test(t)) { r.w = true; r.wt = 'One tip one hand'; t = t.replace(/ one tip one hand | one tip | 1 tip /g, ' '); }
    if (/ no ?ball | noball | no bal | know ball /.test(t)) { r.ex = 'nb'; t = t.replace(/ no ?ball | noball | no bal | know ball /g, ' '); }
    else if (/ wide | wides | white /.test(t)) { r.ex = 'wd'; t = t.replace(/ wides? | white /g, ' '); }
    else if (/ leg ?(bye|byes|by|buy) /.test(t)) { r.ex = 'lb'; t = t.replace(/ leg ?(bye|byes|by|buy) /g, ' '); }
    else if (/ (bye|byes|buy) /.test(t)) { r.ex = 'b'; t = t.replace(/ (bye|byes|buy) /g, ' '); }
    const WT = [[/ run ?out /, 'Run out'], [/ stumped | stumping /, 'Stumped'], [/ hit wicket /, 'Hit wicket'], [/ hit outside | outside /, 'Hit outside'], [/ l ?b ?w | leg before /, 'LBW'], [/ bowled | clean bowled /, 'Bowled'], [/ caught | catch | cot /, 'Caught']];
    for (const [re, k] of WT) if (re.test(t)) { r.w = true; r.wt = r.wt || k; t = t.replace(re, ' '); break; }
    if (!r.w && / (out|wicket|howzat|owzat) /.test(t)) { r.w = true; t = t.replace(/ (out|wicket|howzat|owzat) /g, ' '); }
    t = t.replace(/ (plus|and|runs?|run|off|the|bat|with|a|of|to|too) /g, ' ').replace(/ (plus|and|runs?|run|off|the|bat|with|a|of|to|too) /g, ' ');
    const toks = t.trim().split(' ').filter(Boolean);
    for (const k of toks) { if (/^\d$/.test(k) && +k <= 7) { r.runs = +k; break; } if (k in NUM) { r.runs = NUM[k]; break; } }
    if (r.runs === null && !r.ex && !r.w) return null;
    if (r.runs === null) r.runs = 0;
    return r;
  }
  const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
  const NATIVE = () => !!(window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform());
  const plugCache = {};
  const plug = n => {   // native Capacitor plugin proxy (works without a bundler)
    const C = window.Capacitor; if (!C) return null;
    if (plugCache[n] !== undefined) return plugCache[n];
    let p = C.Plugins && C.Plugins[n];
    if (!p && typeof C.registerPlugin === 'function') { try { p = C.registerPlugin(n); } catch { p = null; } }
    return (plugCache[n] = p || null);
  };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  let rec = null;
  ui.voice = { on: false, heard: '', supported: !!Rec, log: [], pending: null, quietUntil: 0, deferred: null };
  const cap = t => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);
  const who = id => { const n = nm(id); return /\d$/.test(n) ? n : GS.first(id); };   // “Alpha 1” stays “Alpha 1”; “Rohit Sharma” becomes “Rohit”
  const vmode = () => DB.settings.voiceConfirm || 'after';
  const quiet = () => Date.now() < ui.voice.quietUntil || TTS.speaking();
  const ynOf = str => {
    const t = ' ' + String(str).toLowerCase().replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim() + ' ';
    if (/ (yes|yeah|yep|yup|confirm|confirmed|correct|right|ok|okay|haan|han|ha|sahi|record it) /.test(t)) return 'yes';
    if (/ (no|nope|nah|wrong|cancel|discard|incorrect|nahi|nahin|galat) /.test(t)) return 'no';
    return null;
  };
  function logV(e) { ui.voice.log.unshift(Object.assign({ ts: Date.now() }, e)); if (ui.voice.log.length > 6) ui.voice.log.length = 6; }

  /** speak the read-back (recognition is muted while we talk so the app never hears itself) */
  function say(text) {
    if (!text || DB.settings.voiceSpeak === false || vmode() === 'off') return;
    ui.voice.quietUntil = Date.now() + 60000;
    const done = () => { ui.voice.quietUntil = Date.now() + 900; };
    try {
      if (NATIVE() && plug('SpeechRecognition') && ui.voice.on) { try { plug('SpeechRecognition').stop(); } catch { } }
      if (!TTS.available()) return done();
      TTS.speak(text, { lang: 'en-IN', rate: 1.05, interrupt: true, onend: done });
    } catch { done(); }
  }

  function describe(cmd, who) {
    const R = cmd.runs ?? 0;
    let t;
    if (cmd.ex === 'wd') t = 'Wide' + (R ? ` plus ${R}` : '');
    else if (cmd.ex === 'nb') t = 'No ball' + (R ? ` plus ${R}` : '');
    else if (cmd.ex === 'b') t = `${R} bye${R === 1 ? '' : 's'}`;
    else if (cmd.ex === 'lb') t = `${R} leg bye${R === 1 ? '' : 's'}`;
    else if (cmd.w && R === 0) t = '';
    else t = R === 0 ? 'Dot ball' : R === 4 ? 'Four runs' : R === 6 ? 'Six runs' : R === 1 ? '1 run' : `${R} runs`;
    if (cmd.w) t = (t ? t + ', ' : '') + 'wicket' + (cmd.wt ? ` (${cmd.wt.toLowerCase()})` : '');
    return t + (who && !cmd.ex ? ` for ${who}` : '');
  }
  function recorded(s2, ph) {
    const b = s2.ballsList[s2.ballsList.length - 1], bits = [];
    const bat = b.striker ? who(b.striker) : '';
    if (b.wk) bits.push(`${who(b.outId)} is out, ${String(b.wk).toLowerCase()}`);
    else if (!b.ex || b.ex === 'nb') bits.push(`${bat} ${b.bR} off ${b.bB}`);
    if (b.overEnd) bits.push('Over complete');
    if (s2.done) bits.push('Innings complete');
    const tail = s2.need != null && !s2.done ? ` Need ${s2.need} from ${s2.ballsLeft} balls.` : '';
    return {
      state: 'ok',
      say: `${cap(ph)}. ${bits.length ? bits.join('. ') + '. ' : ''}Score ${s2.runs} for ${s2.wkts}, ${s2.oversStr} overs.${tail}`,
      short: `${b.wk ? who(b.outId) + ' out' : bat ? bat + ' ' + b.bR + ' (' + b.bB + ')' : ''} · ${s2.runs}/${s2.wkts} (${s2.oversStr})`,
    };
  }
  const evCount = m => m.innings.length + ':' + m.innings.reduce((a, i) => a + i.events.length, 0);

  // ----- context: the main match scoring screen -----
  const scoreCtx = {
    phrase(cmd) {
      if (cmd.cmd === 'undo') return 'Undo the last ball';
      if (cmd.cmd === 'swap') return 'Swap strike';
      const m = GS.cur(), s = GS.st(m, GS.lastIdx(m));
      return describe(cmd, s.striker ? who(s.striker) : '');
    },
    apply(cmd, heard, ph) {
      const m = GS.cur(); if (!m) return { state: 'blocked', say: 'No match is open.', short: 'No match open' };
      if (cmd.cmd === 'undo') {
        const n0 = evCount(m); A.undo();
        if (evCount(m) === n0) return { state: 'blocked', say: 'There is nothing to undo.', short: 'Nothing to undo' };
        const s = GS.st(m, GS.lastIdx(m));
        return { state: 'undo', say: `Last ball removed. Score is now ${s.runs} for ${s.wkts}, ${s.oversStr} overs.`, short: `${s.runs}/${s.wkts} (${s.oversStr})` };
      }
      const s = GS.st(m, GS.lastIdx(m));
      if (cmd.cmd === 'swap') { A.swap(); const s2 = GS.st(m, GS.lastIdx(m)); return { state: 'swap', say: `Strike swapped. ${s2.striker ? who(s2.striker) : 'Batter'} is on strike.`, short: `${s2.striker ? who(s2.striker) : ''} on strike` }; }
      if (s.done || ui.sheet) return { state: 'blocked', say: 'Please finish the open step on screen first.', short: 'Not recorded – a step is open on screen' };
      const n0 = s.ballsList.length;
      ui.sel = { runs: cmd.runs, ex: cmd.ex, w: cmd.w };
      const finish = () => {
        const s2 = GS.st(m, GS.lastIdx(m));
        return s2.ballsList.length > n0 ? recorded(s2, ph) : { state: 'blocked', say: 'That did not record. Please check the screen.', short: 'Not recorded' };
      };
      if (cmd.w) {
        const types = GS.wicketTypes(m, s), wt = types.includes(cmd.wt) ? cmd.wt : types[0];
        if (['Bowled', 'LBW', 'Hit wicket', 'Hit outside'].includes(wt) && DB.settings.voiceAuto) { GS.commitBall({ wicket: { type: wt, out: s.striker, fielder: null } }); return finish(); }
        ui.sheet = { type: 'wicket', wt }; ui.voice.deferred = { heard, ph, ts: Date.now() }; GS.render();
        return { state: 'input', say: `${cap(wt)}. Please choose who is out and the fielder on screen.`, short: 'Waiting for your choice on screen' };
      }
      if (DB.settings.voiceAuto) { GS.commitBall(null, { noWagon: true }); return finish(); }
      GS.render();
      return { state: 'sel', say: `Selected ${ph}. Tap Next ball to record it.`, short: 'Selected – tap Next Ball to record' };
    },
  };
  GS.voiceHook = () => {   // a ball finished after the wicket sheet that voice opened
    const d = ui.voice.deferred; if (!d) return; ui.voice.deferred = null;
    if (Date.now() - d.ts > 120000) return;
    const m = GS.cur(), r = recorded(GS.st(m, GS.lastIdx(m)), d.ph);
    logV({ heard: d.heard, state: 'ok', text: d.ph + ' – recorded', result: r.short }); say(r.say);
  };
  const ctxNow = () => (ui.view === 'score' && GS.cur() ? scoreCtx : ui.view === 'soloPlay' && typeof Solo !== 'undefined' ? Solo.voiceCtx : null);

  function execute(ctx, cmd, heard, ph) {
    const r = ctx.apply(cmd, heard, ph);
    logV({ heard, state: r.state, text: ph, result: r.short });
    say(r.say); GS.render();
  }
  function stage(ctx, cmd, heard, ph) {
    clearTimeout(ui.voice.pt);
    ui.voice.pending = { cmd, heard, ph };
    say(`I heard: ${ph}. Say yes to record, or no to cancel.`);
    ui.voice.pt = setTimeout(() => {
      const P = ui.voice.pending; if (!P) return; ui.voice.pending = null;
      logV({ heard: P.heard, state: 'cancel', text: `Timed out – not recorded (${P.ph})` }); GS.render();
    }, 25000);
    GS.render();
  }
  function handle(cmd, heard) {
    const ctx = ctxNow(); if (!ctx) return;
    const ph = ctx.phrase(cmd);
    if (vmode() === 'ask') stage(ctx, cmd, heard, ph); else execute(ctx, cmd, heard, ph);
  }
  /** everything the recogniser hears ends up here */
  function onHeard(alts) {
    if (quiet()) return;
    alts = alts.map(a => String(a).trim()).filter(Boolean); if (!alts.length || !ctxNow()) return;
    let cmd = null, said = alts[0];
    for (const a of alts) { cmd = parse(a); if (cmd) { said = a; break; } }
    ui.voice.heard = said;
    const P = ui.voice.pending;
    if (P && !cmd) {
      const yn = alts.map(ynOf).find(Boolean);
      if (yn === 'yes') return A.voiceYes();
      if (yn === 'no') return A.voiceNo();
    }
    if (!cmd) { logV({ heard: said, state: 'miss', text: `Didn't catch a ball in “${said}”` }); GS.render(); return; }
    handle(cmd, said);
  }
  function voiceUI() {
    const v = ui.voice; if (!v.on && !v.log.length && !v.pending) return '';
    const ICON = { ok: '✅', undo: '↩', swap: '⇄', input: '⚠', blocked: '⛔', cancel: '✖', miss: '❓', sel: '📝' };
    const head = v.on ? `<div class="heard">🎤 Listening… ${v.heard ? `last heard “${esc(v.heard)}”` : 'say “four”, “wide plus one”, “bowled”, “undo”'}</div>` : '';
    const pend = v.pending ? `<div class="vpend" role="alert"><div>🎧 I heard: <b>${esc(v.pending.ph)}</b></div><div class="row gap"><button type="button" class="btn primary grow" data-act="voiceYes">✔ Yes, record it</button><button type="button" class="btn" data-act="voiceNo">✖ No</button></div><div class="muted tiny">…or just say “yes” / “no”.</div></div>` : '';
    const log = v.log.slice(0, 4).map((e, k) => `<div class="vlog ${e.state}"><span aria-hidden="true">${ICON[e.state] || ''}</span><div class="grow"><div class="tiny muted">heard “${esc(e.heard)}”</div><div><b>${esc(e.text)}</b></div>${e.result ? `<div class="small">${esc(e.result)}</div>` : ''}</div>${k === 0 && e.state === 'ok' ? '<button type="button" class="btn sm" data-act="voiceFix">↶ Wrong? Undo</button>' : ''}</div>`).join('');
    return head + pend + (log ? `<div class="vlogs" aria-live="polite">${log}</div>` : '');
  }

  // ----- recognition engines -----
  async function startNative() {
    const p = plug('SpeechRecognition');
    try {
      const av = await p.available(); if (av && av.available === false) return GS.toast('Speech recognition is not available on this phone');
      const perm = await p.requestPermissions(); if (perm && perm.speechRecognition && perm.speechRecognition !== 'granted') return GS.toast('Microphone / speech permission denied');
    } catch (e) { return GS.toast('Voice input could not start'); }
    ui.voice.on = true; GS.render();
    while (ui.voice.on) {
      try {
        if (quiet()) { await sleep(300); continue; }
        const r = await p.start({ language: 'en-IN', maxResults: 3, prompt: '', partialResults: false, popup: false });
        if (r && r.matches && r.matches.length) onHeard(r.matches);
      } catch (e) { await sleep(700); }
    }
  }
  function startVoice() {
    ui.voice.log = []; ui.voice.pending = null;
    if (NATIVE() && plug('SpeechRecognition')) return startNative();
    if (!Rec) return GS.toast('Voice input is not supported in this browser – use Chrome on Android');
    rec = new Rec(); rec.lang = 'en-IN'; rec.continuous = true; rec.interimResults = false; rec.maxAlternatives = 3;
    rec.onresult = e => { const res = e.results[e.results.length - 1]; if (!res.isFinal) return; onHeard(Array.from(res).map(a => a.transcript)); };
    rec.onerror = e => { if (e.error === 'not-allowed') { ui.voice.on = false; GS.toast('Microphone permission denied'); GS.render(); } };
    rec.onend = () => { if (ui.voice.on) { try { rec.start(); } catch { } } };
    ui.voice.on = true; try { rec.start(); } catch { } GS.render();
  }
  function stopVoice() {
    ui.voice.on = false; ui.voice.pending = null; clearTimeout(ui.voice.pt);
    try { rec && rec.stop(); } catch { }
    try { const p = NATIVE() && plug('SpeechRecognition'); p && p.stop(); } catch { }
    GS.render();
  }

  // ================= WAGON WHEEL =================
  const groundBase = (lh) => `<circle r="100" class="g1"/><circle r="48" class="g2"/><rect x="-5" y="-30" width="10" height="36" rx="2" class="pitch"/>
    <text x="${lh ? 78 : -78}" y="4" class="glab">LEG</text><text x="${lh ? -78 : 78}" y="4" class="glab">OFF</text><text x="0" y="-86" class="glab">STRAIGHT</text>`;
  const shotColor = r => r >= 6 ? '#6a1b9a' : r === 4 ? '#1565c0' : r >= 2 ? '#2e7d32' : '#78909c';
  function wheel(shots, lh, size = 'big') {
    const lines = shots.map(s => { let [x, y] = s.wg; if (s.r >= 4) { const L = Math.hypot(x, y) || 1; const k = s.r === 6 ? 1.04 : 0.98; x = x / L * k; y = y / L * k; } return `<line x1="0" y1="0" x2="${(x * 100).toFixed(1)}" y2="${(y * 100).toFixed(1)}" stroke="${shotColor(s.r)}" stroke-width="${s.r >= 4 ? 2.4 : 1.6}" stroke-linecap="round"/>`; }).join('');
    return `<svg class="wheel ${size}" viewBox="-110 -110 220 220" role="img" aria-label="Wagon wheel">${groundBase(lh)}${lines}</svg>`;
  }
  function wheelSummary(shots, lh) {
    let off = 0, leg = 0; const z = {};
    shots.forEach(s => { const name = Engine.zone(s.wg, lh); z[name] = (z[name] || 0) + s.r; if (/long off|cover|point|third man/.test(name)) off += s.r; else leg += s.r; });
    const tot = off + leg || 1, best = Object.entries(z).sort((a, b) => b[1] - a[1])[0];
    return `<div class="small">Off side <b>${Math.round(off * 100 / tot)}%</b> · Leg side <b>${Math.round(leg * 100 / tot)}%</b>${best ? ` · favourite zone <b>${esc(best[0])}</b> (${best[1]} runs)` : ''}</div>
      <div class="legend"><span style="--c:#78909c">1</span><span style="--c:#2e7d32">2–3</span><span style="--c:#1565c0">4</span><span style="--c:#6a1b9a">6</span></div>`;
  }
  S.wagon = () => {
    const m = GS.cur(), s = GS.st(m, GS.lastIdx(m)), lh = !!DB.players[s.striker]?.lh;
    const r = ui.sel.runs;
    return `<h3>Where did ${esc(who(s.striker))} hit the ${r}?</h3>
      <div class="wgwrap"><svg class="wheel pick" viewBox="-110 -110 220 220" data-act="wgTap" role="img" aria-label="Tap where the ball went">${groundBase(lh)}</svg></div>
      <p class="muted tiny center">Batter at the centre, bowler towards the top. ${lh ? 'Left-hander view.' : 'Right-hander view (set left-handers in their profile).'}</p>
      <div class="row gap"><button type="button" class="btn" data-act="closeSheet">Back</button><button type="button" class="btn grow" data-act="wgSkip">Skip</button></div>`;
  };

  // ================= QR =================
  S.qr = () => {
    const q = ui.sheet, svg = QR.svg(q.link, { ecl: 'M' });
    return `<h3>${esc(q.title)}</h3>${svg ? `<div class="qrbox">${svg}</div>` : '<p class="small">This link is too long for a QR code – share it instead.</p>'}
      <p class="muted small center">${esc(q.hint || 'Scan with any phone camera')}</p>
      <div class="grid2"><button type="button" class="btn" data-act="closeSheet">Close</button><button type="button" class="btn primary" data-act="qrShare">Share link</button></div>`;
  };

  // ================= POLLS =================
  const getPoll = id => DB.polls.find(p => p.id === id);
  const ST = { in: ['✅', 'In'], maybe: ['🤔', 'Maybe'], out: ['❌', 'Out'] };
  function counts(p) { const c = { in: 0, maybe: 0, out: 0, none: 0 }; p.players.forEach(id => c[p.resp[id] || 'none']++); return c; }
  function pollText(p, link) {
    const c = counts(p), list = s => p.players.filter(id => p.resp[id] === s).map(nm).join(', ') || '–';
    return `🏏 ${p.title}\n${p.when ? '📅 ' + new Date(p.when).toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) + '\n' : ''}${p.where ? '📍 ' + p.where + '\n' : ''}\nWho's in? ${link ? 'Tap to answer: ' + link : 'Reply IN / MAYBE / OUT'}\n\n✅ In (${c.in}): ${list('in')}\n🤔 Maybe (${c.maybe}): ${list('maybe')}\n❌ Out (${c.out}): ${list('out')}`;
  }
  V.polls = () => `${GS.header("Who's in?")}<main>
    <details id="dPN" class="card" ${DB.polls.length ? '' : 'open'}><summary>＋ New availability poll</summary>
      <label>Title</label><input id="pnTitle" value="Sunday gully match" maxlength="50">
      <div class="grid2 stack"><div><label>When</label><input id="pnWhen" type="datetime-local"></div><div><label>Where</label><input id="pnWhere" placeholder="Colony ground" maxlength="40"></div></div>
      <label>Ask these players</label><div class="chips">${GS.pool().sort((a, b) => a.name.localeCompare(b.name)).map(p => `<label class="chipchk"><input type="checkbox" class="pnP" value="${p.id}" checked> ${esc(p.name)}</label>`).join('') || '<span class="muted small">No players yet – add names below.</span>'}</div>
      <label>Add more names (comma separated)</label><input id="pnNew" placeholder="Rohit, Vikram">
      <button type="button" class="btn primary block" data-act="pollCreate">Create poll</button></details>
    ${DB.polls.slice().reverse().map(p => { const c = counts(p); return `<div class="card tap" data-act="pollOpen" data-id="${p.id}"><b>${esc(p.title)}</b><div class="muted small">${p.when ? new Date(p.when).toLocaleString() : ''} ${esc(p.where || '')}</div><div class="small">✅ ${c.in} · 🤔 ${c.maybe} · ❌ ${c.out} · ⏳ ${c.none}</div></div>`; }).join('')}</main>`;
  V.poll = () => {
    const p = getPoll(ui.pollId); if (!p) { ui.view = 'polls'; return V.polls(); }
    const c = counts(p), srv = !!GS.liveBase() && !!GS.appUrl();
    const row = id => `<div class="prow2"><span class="grow">${esc(nm(id))}</span>${Object.entries(ST).map(([k, [ic, l]]) => `<button type="button" class="tog sm ${p.resp[id] === k ? 'sel s' + k : ''}" data-act="pollSet" data-id="${id}" data-k="${k}" aria-label="${l}">${ic}</button>`).join('')}</div>`;
    return `${GS.header(p.title)}<main>
      <div class="card"><div class="muted small">${p.when ? new Date(p.when).toLocaleString() : ''} ${esc(p.where || '')}</div>
        <div class="tally"><div><b>${c.in}</b><span>✅ In</span></div><div><b>${c.maybe}</b><span>🤔 Maybe</span></div><div><b>${c.out}</b><span>❌ Out</span></div><div><b>${c.none}</b><span>⏳ No reply</span></div></div>
        <div class="grid2"><button type="button" class="btn" data-act="pollShare">📤 Share poll</button><button type="button" class="btn" data-act="pollQR" ${srv ? '' : 'disabled'}>▦ QR</button></div>
        ${srv ? '<button type="button" class="btn block" data-act="pollRefresh">🔄 Get responses</button>' : '<p class="muted tiny">Add a live server in Settings so friends can answer by tapping a link. Without it, mark replies from WhatsApp below.</p>'}
        <button type="button" class="btn primary block" data-act="pollToTeams" ${c.in >= 2 ? '' : 'disabled'}>🎲 Make teams from the ${c.in} “In” players</button></div>
      <div class="card"><h4>Replies</h4>${p.players.map(row).join('')}
        <div class="row gap mt"><input id="pAdd" placeholder="Add a name" aria-label="Add a name"><button type="button" class="btn" data-act="pollAdd">Add</button></div></div>
      <button type="button" class="btn danger block" data-act="pollDel">Delete poll</button></main>`;
  };
  V.pollResp = () => {
    const pr = ui.pr;
    if (!pr.info) return `${GS.header("Who's in?", false)}<main><div class="card">${esc(pr.err || 'Loading…')}</div></main>`;
    const me = pr.me, players = Object.entries(pr.info.players).sort((a, b) => a[1].localeCompare(b[1]));
    const tally = { in: [], maybe: [], out: [] }; Object.values(pr.r || {}).forEach(x => x && tally[x.s] && tally[x.s].push(x.name));
    return `${GS.header("Who's in?", false)}<main>
      <div class="card"><div class="big">${esc(pr.info.title)}</div><div class="muted">${pr.info.when ? new Date(pr.info.when).toLocaleString() : ''} ${esc(pr.info.where || '')}</div></div>
      ${me ? `<div class="card"><div class="small muted">Answering as</div><div class="row between"><b>${esc(me.name)}</b><button type="button" class="btn sm" data-act="prChange">Not you?</button></div>
        <div class="bigchoice">${Object.entries(ST).map(([k, [ic, l]]) => `<button type="button" class="tog ${pr.s === k ? 'sel s' + k : ''}" data-act="prVote" data-k="${k}">${ic}<br>${l}</button>`).join('')}</div>
        ${pr.s ? `<p class="center small">Thanks! You said <b>${ST[pr.s][1]}</b>. You can change it any time.</p>` : ''}</div>`
        : `<div class="card"><h4>Who are you?</h4><div class="list">${players.map(([id, n]) => `<button type="button" class="item" data-act="prMe" data-id="${id}">${esc(n)}</button>`).join('')}</div>
        <div class="row gap"><input id="prName" placeholder="Not on the list? Type your name" aria-label="Your name"><button type="button" class="btn" data-act="prMeNew">Go</button></div></div>`}
      <div class="card small"><b>✅ In (${tally.in.length}):</b> ${esc(tally.in.join(', ') || '–')}<br><b>🤔 Maybe (${tally.maybe.length}):</b> ${esc(tally.maybe.join(', ') || '–')}<br><b>❌ Out (${tally.out.length}):</b> ${esc(tally.out.join(', ') || '–')}</div></main>`;
  };
  async function prLoad() {
    const pr = ui.pr;
    try { pr.info = await GS.jget(`${pr.base}/gully-poll/${pr.code}/info.json`); if (!pr.info) pr.err = 'This poll was not found.'; pr.r = await GS.jget(`${pr.base}/gully-poll/${pr.code}/r.json`) || {}; }
    catch (e) { pr.err = 'Could not load the poll: ' + e.message; }
    GS.render();
  }

  // ================= HANDOVER =================
  S.handover = () => {
    const m = GS.cur(), srv = m.live && GS.liveBase();
    return `<h3>📲 Hand over scoring</h3>
      <p class="small">Another scorer can continue this match on their phone – e.g. if your battery is low. ${srv ? 'Because Live is on, the other phone always picks up the <b>latest</b> ball from the server and this phone stops scoring automatically.' : 'The link carries the match so far. After the other phone opens it, stop scoring here.'}</p>
      <div class="qrbox">${ui.sheet.qr || '<p class="muted small">Preparing…</p>'}</div>
      <div class="grid2"><button type="button" class="btn primary" data-act="hoShare">Share link</button><button type="button" class="btn" data-act="closeSheet">Close</button></div>
      ${srv ? '' : '<button type="button" class="btn danger block" data-act="hoDone">I\'ve handed over – stop scoring here</button>'}`;
  };
  S.takeConfirm = () => {
    const b = ui.take.b, m = b.m, i = m.innings.length - 1, inn = m.innings[i];
    const nmB = id => b.p[id] || '—';
    let score = 'Not started';
    if (inn.events.length) { const s = Engine.replay(inn, m.rules, m.teams[inn.bat].players, nmB); score = `${m.teams[inn.bat].name} ${s.runs}/${s.wkts} (${s.oversStr})`; }
    return `<h3>Continue scoring here?</h3><div class="card"><b>${esc(m.teams[0].name)} vs ${esc(m.teams[1].name)}</b><div>${esc(score)}</div></div>
      <p class="small">This phone becomes the scorer for this match.${ui.take.code ? ' The other phone will stop automatically.' : ''}</p>
      <div class="grid2"><button type="button" class="btn" data-act="takeCancel">Cancel</button><button type="button" class="btn primary" data-act="takeYes">Continue scoring ▶</button></div>`;
  };

  Object.assign(A, {
    voiceToggle: () => (ui.voice.on ? stopVoice() : startVoice()),
    voiceApply: cmd => handle(cmd, ui.voice.heard),
    voiceYes: () => { const P = ui.voice.pending; if (!P) return; ui.voice.pending = null; clearTimeout(ui.voice.pt); const ctx = ctxNow(); if (ctx) execute(ctx, P.cmd, P.heard, P.ph); else GS.render(); },
    voiceNo: () => { const P = ui.voice.pending; if (!P) return; ui.voice.pending = null; clearTimeout(ui.voice.pt); logV({ heard: P.heard, state: 'cancel', text: `Cancelled – not recorded (${P.ph})` }); say('Cancelled. Not recorded.'); GS.render(); },
    voiceFix: () => { const ctx = ctxNow(); if (ctx) execute(ctx, { cmd: 'undo' }, '(button)', 'Undo the last ball'); },
    wgTap: (d, el, e) => {
      const r = el.getBoundingClientRect();
      let x = ((e.clientX - r.left) / r.width * 220 - 110) / 100, y = ((e.clientY - r.top) / r.height * 220 - 110) / 100;
      const L = Math.hypot(x, y); if (L > 1) { x /= L; y /= L; }
      if (L < 0.05) return;
      GS.commitBall({ wg: [+x.toFixed(3), +y.toFixed(3)] }, { noWagon: true });
    },
    wgSkip: () => GS.commitBall(null, { noWagon: true }),
    qrShare: () => GS.copyOrShare(ui.sheet.link, ui.sheet.title, ui.sheet.link),
    showQR: (title, link, hint) => { ui.sheet = { type: 'qr', title, link, hint }; GS.render(); },
    pollCreate: () => {
      const ids = [...document.querySelectorAll('.pnP:checked')].map(x => x.value);
      document.getElementById('pnNew').value.split(',').map(x => x.trim()).filter(Boolean).forEach(n => ids.push(GS.playerByName(n)));
      if (!ids.length) return GS.toast('Add at least one player');
      const p = { id: GS.uid(), title: document.getElementById('pnTitle').value.trim() || 'Gully match', when: document.getElementById('pnWhen').value, where: document.getElementById('pnWhere').value.trim(), players: [...new Set(ids)], resp: {}, created: Date.now() };
      DB.polls.push(p); save(); ui.pollId = p.id; ui.view = 'poll'; GS.render();
    },
    pollOpen: d => { ui.pollId = d.id; ui.view = 'poll'; GS.render(); },
    pollSet: d => { const p = getPoll(ui.pollId); if (p.resp[d.id] === d.k) delete p.resp[d.id]; else p.resp[d.id] = d.k; (p.ts || (p.ts = {}))[d.id] = Date.now(); save(); GS.render(); },
    pollAdd: () => { const v = document.getElementById('pAdd').value.trim(); if (!v) return; const p = getPoll(ui.pollId), id = GS.playerByName(v); if (!p.players.includes(id)) p.players.push(id); save(); GS.render(); },
    pollShare: async () => {
      const p = getPoll(ui.pollId); let link = '';
      if (GS.liveBase() && GS.appUrl()) { try { await GS.pollPublish(p); link = GS.pollLink(p); } catch (e) { GS.toast('Could not publish: ' + e.message); } }
      GS.copyOrShare(pollText(p, link), p.title);
    },
    pollQR: async () => { const p = getPoll(ui.pollId); try { await GS.pollPublish(p); A.showQR("Scan to answer: " + p.title, GS.pollLink(p), 'Friends scan this and tap In / Maybe / Out'); } catch (e) { GS.toast(e.message); } },
    pollRefresh: async () => { const p = getPoll(ui.pollId); try { if (!p.code) await GS.pollPublish(p); const n = await GS.pollFetchResponses(p); GS.toast(n ? `${n} new response${n > 1 ? 's' : ''}` : 'No new responses yet'); } catch (e) { GS.toast(e.message); } },
    pollToTeams: () => {
      const p = getPoll(ui.pollId), t = TeamMaker.T();
      t.avail = p.players.filter(id => p.resp[id] === 'in'); t.A = []; t.B = []; t.common = null; t.sel = [];
      save(); ui.view = 'teams'; GS.render(); GS.toast(`${t.avail.length} players in the pool – tap Make balanced teams`);
    },
    pollDel: () => { if (!confirm('Delete this poll?')) return; DB.polls = DB.polls.filter(p => p.id !== ui.pollId); save(); ui.view = 'polls'; GS.render(); },
    prMe: d => { ui.pr.me = { pid: d.id, name: ui.pr.info.players[d.id] }; localStorage.setItem('gs.poll.' + ui.pr.code, JSON.stringify(ui.pr.me)); const mine = ui.pr.r?.[d.id]; ui.pr.s = mine?.s || null; GS.render(); },
    prMeNew: () => { const n = document.getElementById('prName').value.trim(); if (!n) return; ui.pr.me = { pid: null, name: n }; localStorage.setItem('gs.poll.' + ui.pr.code, JSON.stringify(ui.pr.me)); GS.render(); },
    prChange: () => { ui.pr.me = null; ui.pr.s = null; localStorage.removeItem('gs.poll.' + ui.pr.code); GS.render(); },
    prVote: async d => {
      const pr = ui.pr, key = pr.me.pid || ('n_' + pr.me.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 30));
      const rec = { pid: pr.me.pid, name: pr.me.name, s: d.k, ts: Date.now() };
      try { await GS.jput(`${pr.base}/gully-poll/${pr.code}/r/${key}.json`, rec); pr.s = d.k; (pr.r || (pr.r = {}))[key] = rec; GS.toast('Saved – thanks!'); }
      catch (e) { GS.toast('Could not save: ' + e.message); }
      GS.render();
    },
    handover: async () => {
      const m = GS.cur(); ui.sheet = { type: 'handover' }; GS.render();
      const link = m.live && GS.liveBase() ? GS.takeoverLink(m) : await GS.handoverLink(m);
      if (!link) { ui.sheet = null; GS.toast('Set the Public app URL in Settings first'); return; }
      ui.sheet.link = link; ui.sheet.qr = QR.svg(link, { ecl: 'L' }) || '<p class="small">Match too long for a QR – use Share link.</p>'; GS.render();
    },
    hoShare: () => { const m = GS.cur(); GS.copyOrShare(ui.sheet.link, `Take over scoring: ${m.teams[0].name} vs ${m.teams[1].name}`, ui.sheet.link); },
    hoDone: () => { const m = GS.cur(); m.status = 'handed'; m.handedAt = Date.now(); DB.current = null; save(); ui.sheet = null; ui.view = 'home'; GS.render(); },
    takeYes: async () => {
      const { b, code, base } = ui.take;
      if (code && !GS.liveBase()) DB.settings.liveUrl = base;
      GS.takeMatch(b, code);
      if (code) { try { await GS.claimLive(code); } catch { } }
      ui.take = null; ui.sheet = null; history.replaceState(null, '', location.pathname + location.search); ui.view = 'score'; GS.render(); GS.toast('You are now scoring this match');
    },
    takeCancel: () => { ui.take = null; ui.sheet = null; history.replaceState(null, '', location.pathname + location.search); GS.render(); },
    takeBack: async d => {
      const m = DB.matches.find(x => x.id === d.id); if (!m) return;
      if (m.live && GS.liveBase()) {
        try { const b = await GS.liveFetch(GS.liveBase(), m.live); GS.takeMatch(b, m.live); await GS.claimLive(m.live); GS.toast('Scoring is back on this phone (latest ball loaded)'); }
        catch (e) { GS.toast('Could not reach live server: ' + e.message); return; }
      } else { m.status = 'live'; DB.current = m.id; save(); GS.toast('Resumed from this phone’s copy'); }
      ui.view = 'score'; GS.render();
    },
  });

  async function bootLinks(h) {
    if (h.startsWith('#poll=')) {
      const [base, code] = h.slice(6).split('~');
      ui.readonly = true; ui.view = 'pollResp';
      let me = null; try { me = JSON.parse(localStorage.getItem('gs.poll.' + code)); } catch { }
      ui.pr = { base: decodeURIComponent(base), code, me, s: null };
      GS.render(); await prLoad();
      if (me) { const k = me.pid || ('n_' + me.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 30)); ui.pr.s = ui.pr.r?.[k]?.s || null; GS.render(); }
      return true;
    }
    if (h.startsWith('#take=') || h.startsWith('#takeover=')) {
      try {
        if (h.startsWith('#take=')) ui.take = { b: await GS.unpack(h.slice(6)) };
        else { const [base, code] = h.slice(10).split('~'); const b64 = decodeURIComponent(base); ui.take = { b: await GS.liveFetch(b64, code), code, base: b64 }; }
        ui.sheet = { type: 'takeConfirm' };
      } catch (e) { GS.toast('This handover link did not work: ' + e.message); }
      return false;
    }
    return false;
  }

  return { parse, wheel, wheelSummary, bootLinks, startVoice, stopVoice, voiceUI, say, onHeard };
})();

