/* Gully Scorer – Commentary engine: variant pools, randomness, Hindi/English, male/female Indian voices, Commentary Studio */
'use strict';
const Comm = (() => {
  const { DB, ui, esc, save, V, S, A } = GS;
  const D = CommData;
  const KEYS = Object.keys(D.cats);
  const GROUPS = [...new Set(KEYS.map(k => D.cats[k].group))];

  const DEF = { lang: 'both', hiShare: 50, textLang: 'en', voice: 'both', femShare: 50, rand: 70, styles: { classic: 40, paaji: 30, silk: 30 }, count: 50, counts: {}, seed: 1, custom: {}, banned: {},
    rate: 1, pitch: 1, vmap: {}, speakDots: true, speakSingles: true, speakOver: true, speakScore: true, speakChase: true };
  const cfg = () => {
    const c = DB.settings.cv || (DB.settings.cv = {});
    Object.entries(DEF).forEach(([k, v]) => { if (c[k] === undefined) c[k] = JSON.parse(JSON.stringify(v)); });
    return c;
  };

  // ---------- seeded helpers ----------
  const hash = str => { let h = 2166136261; for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619); return h >>> 0; };
  const rng = seed => { let a = hash(String(seed)) || 1; return () => { a ^= a << 13; a ^= a >>> 17; a ^= a << 5; return (a >>> 0) / 4294967296; }; };
  const shuffle = (arr, r) => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };

  function join(o, core, t, lang) {
    let c = core;
    if (lang === 'en' && o && /,$/.test(o) && /^[A-Z][a-z]/.test(c)) c = c[0].toLowerCase() + c.slice(1);
    return [o, c, t].filter(Boolean).join(' ');
  }
  const mvMemo = {};
  const maxVariety = key => {
    const c = cfg(), st = Object.keys(D.styles).filter(s => (c.styles[s] || 0) > 0), mk = key + st.join(',');
    if (mvMemo[mk]) return mvMemo[mk];
    const cat = D.cats[key];
    const n = Math.min(...['en', 'hi'].map(lang => { const set = new Set(); st.forEach(s => { const m = D.styles[s].moods[cat.mood][lang]; ['', ...m.o].forEach(o => cat[lang].forEach(core => ['', ...m.t].forEach(t => set.add(join(o, core, t, lang))))); }); return set.size; }));
    return (mvMemo[mk] = n);
  };
  const countFor = key => { const c = cfg(); const n = c.counts[key] ?? c.count; return Math.max(1, Math.min(+n || 1, maxVariety(key) || 1)); };

  // ---------- pools (memoised by config signature) ----------
  let memo = {};
  function pool(key, lang) {
    const c = cfg(), cat = D.cats[key]; if (!cat) return [];
    const sig = JSON.stringify([c.seed, c.styles, countFor(key), (c.custom[key] || {})[lang], (c.banned[key] || {})[lang]]);
    const mk = key + '|' + lang;
    if (memo[mk] && memo[mk].sig === sig) return memo[mk].list;
    const N = countFor(key), banned = new Set(((c.banned[key] || {})[lang]) || []);
    const st = Object.keys(D.styles).filter(s => (c.styles[s] || 0) > 0);
    const totW = st.reduce((a, s) => a + c.styles[s], 0) || 1;
    // largest-remainder allocation of N across styles
    const alloc = st.map(s => ({ s, x: N * c.styles[s] / totW }));
    alloc.forEach(a => a.n = Math.floor(a.x));
    let left = N - alloc.reduce((a, b) => a + b.n, 0);
    alloc.slice().sort((a, b) => (b.x - b.n) - (a.x - a.n)).forEach(a => { if (left > 0) { a.n++; left--; } });
    const out = [], seen = new Set(banned), leftovers = [];
    (((c.custom[key] || {})[lang]) || []).forEach(t => seen.add(t));
    alloc.forEach(({ s, n }) => {
      const m = D.styles[s].moods[cat.mood][lang], cores = cat[lang];
      const combos = [];
      ['', ...m.o].forEach(o => cores.forEach(core => ['', ...m.t].forEach(t => combos.push({ s, text: join(o, core, t, lang) }))));
      shuffle(combos, rng(`${c.seed}|${key}|${lang}|${s}`));
      let taken = 0; const rest = [];
      for (const x of combos) { if (seen.has(x.text)) continue; if (taken >= n) { rest.push(x); continue; } seen.add(x.text); out.push(x); taken++; }
      leftovers.push(rest);
    });
    // a style can run out of unique lines – top up from the others
    for (let k = 0; out.length < N && leftovers.some(r => r.length); k++) {
      const r = leftovers[k % leftovers.length], x = r.shift();
      if (x && !seen.has(x.text)) { seen.add(x.text); out.push(x); }
    }
    (((c.custom[key] || {})[lang]) || []).forEach(t => out.push({ s: 'custom', text: t }));
    shuffle(out, rng(`${c.seed}|${key}|${lang}|mix`));
    memo[mk] = { sig, list: out };
    return out;
  }

  // ---------- fill placeholders ----------
  function fill(text, c, lang, speak) {
    const fb = D.fallback[lang];
    const v = Object.assign({}, c);
    v.zone = c.zone ? (lang === 'hi' ? D.zoneHi[c.zone] || c.zone : c.zone) : fb.zone[hash(text + (c.bt || '')) % fb.zone.length];
    v.f = c.f || (c.keeper ? fb.fk : fb.f);
    if (c.dec) v.dec = fb.dec[c.dec] || c.dec;
    if (Array.isArray(c.score)) v.score = speak ? (lang === 'hi' ? `${c.score[0]} पर ${c.score[1]}` : `${c.score[0]} for ${c.score[1]}`) : `${c.score[0]}/${c.score[1]}`;
    return text.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? '');
  }

  // ---------- language / gender choice ----------
  function chooseLang(r = Math.random) { const c = cfg(); return c.lang === 'both' ? (r() * 100 < c.hiShare ? 'hi' : 'en') : c.lang; }
  function chooseGender(r = Math.random) { const c = cfg(); return c.voice === 'both' ? (r() * 100 < c.femShare ? 'f' : 'm') : c.voice; }
  function textLang(seed) { const c = cfg(); if (c.textLang !== 'mix') return c.textLang; return (hash(seed + '|L') % 100) < c.hiShare ? 'hi' : 'en'; }

  /** deterministic line (scorecard / written commentary) */
  function text(key, c, seed) {
    const lang = textLang(seed), p = pool(key, lang); if (!p.length) return '';
    return fill(p[hash(seed + '|' + cfg().seed) % p.length].text, c, lang, false);
  }

  // ---------- live picker with randomness ----------
  const pk = {};
  function pick(key, lang) {
    const p = pool(key, lang); if (!p.length) return null;
    const c = cfg(), mk = key + '|' + lang + '|' + p.length;
    const s = pk[mk] || (pk[mk] = { i: Math.floor(Math.random() * p.length), recent: [] });
    let idx;
    if (Math.random() * 100 < c.rand && p.length > 1) {
      const avoid = new Set(s.recent), opts = p.map((_, i) => i).filter(i => !avoid.has(i));
      idx = opts[Math.floor(Math.random() * opts.length)];
    } else { idx = s.i % p.length; s.i++; }
    s.recent.push(idx); const keep = Math.min(12, Math.floor(p.length / 2)); while (s.recent.length > keep) s.recent.shift();
    return p[idx];
  }

  // ---------- voices ----------
  const FEM = /heera|kalpana|swara|neerja|aarohi|ananya|kavya|aditi|raveena|lekha|veena|priya|sangeeta|zira|female|woman|samantha|google हिन्दी|google hindi|hia|hic|ahp|cxx|ena/i;
  const MAL = /ravi|hemant|prabhat|madhur|aarav|kunal|rehaan|arjun|male\b|\bman\b|david|mark|guy|hid|hie|end|kun/i;
  let voiceList = [];
  function loadVoices() {
    if (!TTS.available()) return [];
    voiceList = TTS.voices().filter(v => /^(en|hi)/i.test(v.lang));
    return voiceList;
  }
  if (TTS.available()) { loadVoices(); TTS.onVoices(() => { loadVoices(); if (ui.view === 'studio') GS.render(); }); if (window.speechSynthesis) speechSynthesis.addEventListener?.('voiceschanged', () => { loadVoices(); if (ui.view === 'studio') GS.render(); }); }
  function genderOf(v) {
    const m = cfg().vmap[v.voiceURI || v.name];
    if (m) return m;
    const n = v.name + ' ' + (v.voiceURI || '');
    if (/female/i.test(n)) return 'f';
    if (/\bmale\b/i.test(n)) return 'm';
    if (FEM.test(n)) return 'f'; if (MAL.test(n)) return 'm'; return '?';
  }
  const langOk = (v, lang) => v.lang.toLowerCase().replace('_', '-').startsWith(lang);
  const isIN = v => /-in$/i.test(v.lang.replace('_', '-'));
  /** best voice for lang+gender. Returns {voice, pitch, simulated} */
  function voiceFor(lang, g) {
    const vs = (voiceList.length ? voiceList : loadVoices()).filter(v => langOk(v, lang) && genderOf(v) !== 'x');
    if (!vs.length) return null;
    const rank = v => (isIN(v) ? 0 : 2) + (v.localService ? 0 : 0.5);
    const match = vs.filter(v => genderOf(v) === g).sort((a, b) => rank(a) - rank(b));
    const base = cfg().pitch;
    if (match.length) return { voice: match[0], pitch: base, simulated: false };
    const any = vs.slice().sort((a, b) => rank(a) - rank(b))[0];
    const og = genderOf(any);
    const pitch = g === 'm' ? (og === 'f' ? 0.65 : 0.85) : (og === 'm' ? 1.45 : 1.15);
    return { voice: any, pitch: base * pitch, simulated: true };
  }

  function utter(text, lang, g) {
    if (!TTS.available() || !text) return null;
    let vf = voiceFor(lang, g);
    if (!vf && lang === 'hi') return { fallback: true };
    const u = TTS.speak(text.replace(/[🎉💯🔥🏆👑]/gu, ''), { lang: lang === 'hi' ? 'hi-IN' : 'en-IN', voice: vf ? vf.voice : null, pitch: vf ? vf.pitch : cfg().pitch, rate: cfg().rate });
    return { u, vf };
  }

  /** speak a list of events [{key,c}] – language & voice chosen per line with the configured randomness */
  function say(evs, opts = {}) {
    if (!DB.settings.speak || !TTS.available()) return [];
    const c = cfg(); const spoken = [];
    if (opts.interrupt !== false) TTS.cancel();
    let lastLang = 'en', lastG = 'm';
    evs.forEach(e => {
      let lang = chooseLang(), g = chooseGender();
      let item = pick(e.key, lang);
      if (lang === 'hi' && !voiceFor('hi', g)) { lang = 'en'; item = pick(e.key, 'en'); }
      if (!item) return;
      const t = fill(item.text, e.c, lang, true);
      utter(t, lang, g); spoken.push({ text: fill(item.text, e.c, lang, false), lang, g, style: item.s });
      lastLang = lang; lastG = g;
    });
    if (opts.score && c.speakScore) {
      const sc = opts.score, t = lastLang === 'hi' ? `${sc.team}, ${sc.runs} पर ${sc.wkts}।` : `${sc.team}, ${sc.runs} for ${sc.wkts}.`;
      utter(t, lastLang, lastG);
    }
    return spoken;
  }
  function filterEvs(evs) {
    const c = cfg();
    return evs.filter(e => !((e.key === 'dot' && !c.speakDots) || (e.key === 'r1' && !c.speakSingles) || (['overEnd', 'maiden'].includes(e.key) && !c.speakOver) || (e.key === 'equation' && !c.speakChase)));
  }

  const SAMPLE = { bt: 'Rohit', bw: 'Vikram', f: 'Ankit', out: 'Rohit', zone: 'cover', r: 2, n: 50, b: 31, team: 'Colony Kings', opp: 'Rooftop Rebels', score: [86, 3], o: 4, p: 'Rohit', dec: 'bat' };
  // ================= STUDIO =================
  const slider = (k, label, val, suf = '%', min = 0, max = 100, step = 5) => `<div class="sl"><label>${label} <output>${val}${suf}</output></label><input type="range" min="${min}" max="${max}" step="${step}" value="${val}" data-chg="cvSet" data-k="${k}" aria-label="${esc(label.replace(/<[^>]+>/g, ''))}"></div>`;
  const seg = (k, val, opts) => `<div class="seg" role="group">${opts.map(([v, l]) => `<button type="button" class="${val === v ? 'on' : ''}" data-act="cvSeg" data-k="${k}" data-v="${v}" aria-pressed="${val === v}">${l}</button>`).join('')}</div>`;
  V.studio = () => {
    const c = cfg(); loadVoices();
    const vs = voiceList.slice().sort((a, b) => (isIN(b) - isIN(a)) || a.lang.localeCompare(b.lang));
    const have = { en: { m: 0, f: 0 }, hi: { m: 0, f: 0 } };
    vs.forEach(v => { const g = genderOf(v), l = langOk(v, 'hi') ? 'hi' : 'en'; if (g === 'm' || g === 'f') have[l][g]++; });
    const warn = [];
    if (TTS.available() && vs.length) {
      if (!vs.some(v => langOk(v, 'hi'))) warn.push('No Hindi voice on this phone – Hindi lines will be spoken in English. Install “Hindi (India)” in Android Settings → Text-to-speech → Google → Install voice data.');
      ['en', 'hi'].forEach(l => ['m', 'f'].forEach(g => { if (vs.some(v => langOk(v, l)) && !have[l][g]) warn.push(`No ${g === 'm' ? 'male' : 'female'} ${l === 'hi' ? 'Hindi' : 'English'} voice detected – I'll imitate one by changing pitch. Tag voices below if a guess is wrong.`); }));
    }
    const vrow = v => { const g = genderOf(v), set = c.vmap[v.voiceURI || v.name] || ''; return `<div class="vrow"><div class="grow"><b>${esc(v.name)}</b><div class="muted tiny">${esc(v.lang)}${v.localService ? ' · offline' : ' · online'} · ${g === 'm' ? 'male' : g === 'f' ? 'female' : g === 'x' ? 'not used' : 'unknown'}${set ? ' (set by you)' : ''}</div></div>
      <select data-chg="cvVoice" data-id="${esc(v.voiceURI || v.name)}" aria-label="Voice type"><option value="">Auto</option><option value="m" ${set === 'm' ? 'selected' : ''}>Male</option><option value="f" ${set === 'f' ? 'selected' : ''}>Female</option><option value="x" ${set === 'x' ? 'selected' : ''}>Don't use</option></select>
      <button type="button" class="btn sm" data-act="cvTestVoice" data-id="${esc(v.voiceURI || v.name)}" aria-label="Test voice">▶</button></div>`; };
    const totW = Object.values(c.styles).reduce((a, b) => a + b, 0) || 1;
    const groups = GROUPS.map(g => `<h3>${g}</h3><div class="card tight">${KEYS.filter(k => D.cats[k].group === g).map(k => {
      const ov = c.counts[k] != null, cu = ((c.custom[k] || {}).en || []).length + ((c.custom[k] || {}).hi || []).length;
      return `<div class="crow"><button type="button" class="linkbtn grow" data-act="cvOpen" data-k="${k}">${esc(D.cats[k].label)}${cu ? ` <span class="pill">+${cu} yours</span>` : ''}</button>
        <input type="number" min="1" max="${maxVariety(k)}" value="${ov ? c.counts[k] : ''}" placeholder="${c.count}" data-chg="cvCount" data-k="${k}" aria-label="Variety for ${esc(D.cats[k].label)}" class="cnt ${ov ? 'ov' : ''}">
        <button type="button" class="btn sm" data-act="cvPlay" data-k="${k}" aria-label="Hear a sample">▶</button></div>`; }).join('')}</div>`).join('');
    return `${GS.header('Commentary studio')}<main>
      <div class="card"><label class="chk"><input type="checkbox" data-chg="cvSpeak" ${DB.settings.speak ? 'checked' : ''}> <b>Speak commentary after every ball</b></label>
        <button type="button" class="btn block" data-act="cvDemo">▶ Play a demo over</button></div>
      <div class="card"><h4>🗣 Language</h4>
        <label>Spoken</label>${seg('lang', c.lang, [['en', 'English'], ['hi', 'हिन्दी'], ['both', 'Both']])}
        ${c.lang === 'both' ? slider('hiShare', 'Hindi share (rest English)', c.hiShare) : ''}
        <label>Written (scorecard & live viewer)</label>${seg('textLang', c.textLang, [['en', 'English'], ['hi', 'हिन्दी'], ['mix', 'Mixed']])}</div>
      <div class="card"><h4>🎙 Voice</h4>${seg('voice', c.voice, [['m', 'Male'], ['f', 'Female'], ['both', 'Both']])}
        ${c.voice === 'both' ? slider('femShare', 'Chance of female voice per line', c.femShare) : ''}
        ${slider('rate', 'Speed', c.rate, '×', 0.6, 1.6, 0.05)}${slider('pitch', 'Pitch', c.pitch, '×', 0.6, 1.4, 0.05)}
        ${warn.map(w => `<p class="warnline">⚠️ ${esc(w)}</p>`).join('')}
        <p class="muted tiny">Speech engine: <b>${TTS.available() ? (TTS.isNative() ? 'phone’s own text-to-speech' : 'browser') : 'none found'}</b>${TTS.isNative() ? ' <button type="button" class="btn sm" data-act="cvInstall">Install / manage voices</button> <button type="button" class="btn sm" data-act="cvReload">↻ Refresh</button>' : ''}</p>
        <details id="dVoices"><summary>Voices on this phone (${vs.length})</summary>${vs.map(vrow).join('') || '<p class="muted small">' + (TTS.available() ? 'No voices reported yet. Tap ▶ once, or ↻ Refresh – some phones load voices on first use. On Android also check Settings → System → Languages → Text-to-speech output.' : 'This device has no speech engine.') + '</p>'}</details></div>
      <div class="card"><h4>🎭 Commentator style mix</h4>
        ${Object.entries(D.styles).map(([k, s]) => `${slider('st.' + k, `${s.label} <span class="muted tiny">– ${s.desc}</span>`, c.styles[k] || 0, '')}`).join('')}
        <p class="muted tiny">Shares: ${Object.entries(D.styles).map(([k, s]) => `${s.label.split(' ')[0]} ${Math.round(100 * (c.styles[k] || 0) / totW)}%`).join(' · ')}. Set a style to 0 to switch it off.</p></div>
      <div class="card"><h4>🎲 Randomness & variety</h4>
        ${slider('rand', 'Randomness', c.rand)}
        <p class="muted tiny">0% = goes through the variations in order (never repeats until all are used). 100% = fully random (still avoids the last few lines).</p>
        <div class="row gap"><label class="grow">Variations per event (all events)<input type="number" min="1" max="500" value="${c.count}" data-chg="cvGlobal" aria-label="Variations per event"></label></div>
        <div class="grid2"><button type="button" class="btn" data-act="cvReseed">🔀 New set of variations</button><button type="button" class="btn" data-act="cvResetCounts">Reset per-event counts</button></div>
        <p class="muted tiny">Each event can also have its own count below (blank = use the global number). Up to ${maxVariety('r2')} unique lines per event per language with the current styles.</p></div>
      <div class="card"><h4>🔈 What to say</h4>
        ${[['speakDots', 'Dot balls'], ['speakSingles', 'Singles'], ['speakOver', 'End-of-over summary'], ['speakChase', 'Chase equation'], ['speakScore', 'Score after every ball']].map(([k, l]) => `<label class="chk"><input type="checkbox" data-chg="cvFlag" data-k="${k}" ${c[k] ? 'checked' : ''}> ${l}</label>`).join('')}</div>
      ${groups}
      <p class="muted tiny center">Tap an event to see, hear, remove or add your own lines.</p></main>`;
  };

  S.catLines = () => {
    const k = ui.sheet.k, lang = ui.sheet.lang || 'en', c = cfg(), p = pool(k, lang), cat = D.cats[k];
    const sample = SAMPLE;
    const custom = new Set(((c.custom[k] || {})[lang]) || []);
    return `<h3>${esc(cat.label)} <span class="muted small">· ${p.length} lines</span></h3>
      ${seg('sheetLang', lang, [['en', 'English'], ['hi', 'हिन्दी']])}
      <div class="lines">${p.map((x, i) => `<div class="lrow"><span class="stag s-${x.s}">${x.s === 'custom' ? 'yours' : esc(D.styles[x.s].label.split(' ')[0])}</span><span class="grow">${esc(fill(x.text, sample, lang, false))}</span>
        <button type="button" class="btn sm" data-act="cvSay" data-i="${i}" aria-label="Hear">▶</button>
        <button type="button" class="btn sm" data-act="${custom.has(x.text) ? 'cvDelCustom' : 'cvBan'}" data-i="${i}" aria-label="Remove">✕</button></div>`).join('')}</div>
      <label for="cvNew">Add your own line (${lang === 'hi' ? 'Hindi' : 'English'})</label>
      <div class="row gap"><input id="cvNew" placeholder="${lang === 'hi' ? 'क्या शॉट है {bt}!' : 'What a hit by {bt} off {bw}!'}"><button type="button" class="btn" data-act="cvAdd">Add</button></div>
      <p class="muted tiny">Use {bt} batter, {bw} bowler, {f} fielder, {zone}, {r} runs, {n} number, {b} balls, {team}, {opp}, {score}, {p} player. Removed lines are replaced automatically by other variations.</p>
      <div class="grid2"><button type="button" class="btn" data-act="cvUnban">Restore removed</button><button type="button" class="btn primary" data-act="closeSheet">Done</button></div>`;
  };

  const demoEvents = () => {
    const base = { bt: 'Rohit', bw: 'Vikram', f: 'Ankit', team: 'Colony Kings', opp: 'Rooftop Rebels' };
    return [{ key: 'toss', c: { ...base, dec: 'bat' } }, { key: 'r4', c: { ...base, zone: 'cover' } }, { key: 'r2', c: { ...base, zone: 'mid-wicket' } }, { key: 'wd', c: { ...base, r: 1 } }, { key: 'r6', c: { ...base, zone: 'long on' } }, { key: 'caught', c: base }, { key: 'overEnd', c: { ...base, o: 1, score: [13, 1], r: 13 } }];
  };

  Object.assign(A, {
    studio: () => { ui.studioFrom = ui.view; ui.sheet = null; ui.view = 'studio'; window.scrollTo(0, 0); GS.render(); },
    cvSpeak: (d, el) => { DB.settings.speak = el.checked; save(); },
    cvSet: (d, el) => {
      const c = cfg(), v = +el.value;
      if (d.k.startsWith('st.')) c.styles[d.k.slice(3)] = v; else c[d.k] = v;
      if (d.k.startsWith('st.') && !Object.values(c.styles).some(x => x > 0)) { c.styles[d.k.slice(3)] = 5; GS.toast('At least one style must stay on'); }
      memo = {}; save(); GS.render();
    },
    cvSeg: d => { if (d.k === 'sheetLang') { ui.sheet.lang = d.v; GS.render(); return; } cfg()[d.k] = d.v; save(); GS.render(); },
    cvFlag: (d, el) => { cfg()[d.k] = el.checked; save(); },
    cvGlobal: (d, el) => { cfg().count = Math.max(1, Math.min(500, +el.value || 50)); memo = {}; save(); GS.render(); GS.toast(`${cfg().count} variations per event`); },
    cvCount: (d, el) => { const c = cfg(); if (el.value === '') delete c.counts[d.k]; else c.counts[d.k] = Math.max(1, Math.min(maxVariety(d.k), +el.value)); memo = {}; save(); GS.render(); },
    cvResetCounts: () => { cfg().counts = {}; memo = {}; save(); GS.render(); },
    cvReseed: () => { cfg().seed = (cfg().seed || 1) + 1; memo = {}; save(); GS.toast('Fresh set of variations generated'); },
    cvVoice: (d, el) => { const c = cfg(); if (el.value) c.vmap[d.id] = el.value; else delete c.vmap[d.id]; save(); GS.render(); },
    cvTestVoice: d => {
      const v = voiceList.find(x => (x.voiceURI || x.name) === d.id); if (!v || !TTS.available()) return;
      TTS.cancel(); const hi = langOk(v, 'hi');
      TTS.speak(hi ? 'चौका! क्या शानदार शॉट है।' : 'Four! What a shot that is.', { voice: v, lang: v.lang, rate: cfg().rate, interrupt: true });
    },
    cvInstall: () => TTS.openInstall(),
    cvReload: () => { TTS.reload(); GS.toast('Looking for voices…'); setTimeout(() => GS.render(), 1200); },
    cvOpen: d => { ui.sheet = { type: 'catLines', k: d.k, lang: cfg().lang === 'hi' ? 'hi' : 'en' }; GS.render(); },
    cvPlay: d => { if (!TTS.available()) return GS.toast('No speech engine found on this device'); const was = DB.settings.speak; DB.settings.speak = true; const sp = say([{ key: d.k, c: SAMPLE }]); DB.settings.speak = was; if (sp[0]) GS.toast(sp[0].text); },
    cvDemo: () => { if (!TTS.available()) return GS.toast('No speech engine found on this device'); const was = DB.settings.speak; DB.settings.speak = true; say(demoEvents()); DB.settings.speak = was; },
    cvSay: d => {
      const k = ui.sheet.k, lang = ui.sheet.lang || 'en', x = pool(k, lang)[+d.i]; if (!x || !TTS.available()) return;
      TTS.cancel();
      const r = utter(fill(x.text, SAMPLE, lang, true), lang, chooseGender());
      if (r?.fallback) GS.toast('No Hindi voice installed on this phone');
    },
    cvBan: d => {
      const c = cfg(), k = ui.sheet.k, lang = ui.sheet.lang || 'en', x = pool(k, lang)[+d.i]; if (!x) return;
      const b = (c.banned[k] || (c.banned[k] = {})); (b[lang] || (b[lang] = [])).push(x.text);
      memo = {}; save(); GS.render();
    },
    cvUnban: () => { const c = cfg(), k = ui.sheet.k, lang = ui.sheet.lang || 'en'; if (c.banned[k]) c.banned[k][lang] = []; memo = {}; save(); GS.render(); },
    cvAdd: () => {
      const v = document.getElementById('cvNew').value.trim(); if (!v) return;
      const c = cfg(), k = ui.sheet.k, lang = ui.sheet.lang || 'en';
      const cu = (c.custom[k] || (c.custom[k] = {})); (cu[lang] || (cu[lang] = [])).push(v);
      memo = {}; save(); GS.render(); GS.toast('Line added');
    },
    cvDelCustom: d => {
      const c = cfg(), k = ui.sheet.k, lang = ui.sheet.lang || 'en', x = pool(k, lang)[+d.i];
      c.custom[k][lang] = c.custom[k][lang].filter(t => t !== x.text); memo = {}; save(); GS.render();
    },
  });

  return { KEYS, cfg, pool, text, pick, fill, say, filterEvs, voiceFor, genderOf, loadVoices, maxVariety, countFor, chooseLang, chooseGender, utter, _reset: () => { memo = {}; } };
})();

