/* Gully Scorer – speech output. One API for the browser (speechSynthesis) and the native Android / iOS apps
   (Capacitor Text-to-Speech plugin). Android's WebView has no speechSynthesis at all, hence this layer. */
'use strict';
const TTS = (() => {
  const C = () => window.Capacitor;
  const isNativePlatform = () => !!(C() && typeof C().isNativePlatform === 'function' && C().isNativePlatform());
  let _p;
  const plugin = () => {
    if (_p !== undefined) return _p;
    const c = C(); let p = c && c.Plugins && c.Plugins.TextToSpeech;
    if (!p && c && typeof c.registerPlugin === 'function') { try { p = c.registerPlugin('TextToSpeech'); } catch { p = null; } }
    return (_p = p || null);
  };
  const useNative = () => isNativePlatform() && !!plugin();
  const web = () => !!window.speechSynthesis && typeof window.SpeechSynthesisUtterance === 'function';
  const available = () => useNative() || web();

  let nvoices = [], gen = 0, chain = Promise.resolve(), busy = 0, loaded = false;
  const listeners = [];
  const onVoices = fn => listeners.push(fn);
  async function loadNative() {
    try {
      const r = await plugin().getSupportedVoices();
      nvoices = ((r && r.voices) || []).map((v, i) => ({ name: v.name || v.voiceURI, voiceURI: v.voiceURI || v.name, lang: String(v.lang || ''), localService: v.localService !== false, default: !!v.default, _idx: i }));
    } catch { nvoices = []; }
    loaded = true; listeners.forEach(f => { try { f(); } catch { } });
  }
  if (useNative()) { loadNative(); setTimeout(() => { if (!nvoices.length) loadNative(); }, 2000); setTimeout(() => { if (!nvoices.length) loadNative(); }, 6000); }

  const voices = () => (useNative() ? nvoices : web() ? speechSynthesis.getVoices() : []);

  /** speak(text, {lang, voice, pitch, rate, onend, interrupt}) – voice is an item from voices() */
  function speak(text, o = {}) {
    if (!text) return null;
    if (useNative()) {
      if (o.interrupt) cancel();
      const g = gen; busy++;
      const opt = { text, lang: (o.lang || (o.voice && o.voice.lang) || 'en-IN').replace('_', '-'), rate: o.rate != null ? o.rate : 1, pitch: o.pitch != null ? o.pitch : 1, volume: 1, category: 'ambient', queueStrategy: 1 };
      if (o.voice && o.voice._idx != null) opt.voice = o.voice._idx;
      chain = chain.then(() => (g !== gen ? null : plugin().speak(opt))).catch(() => { }).then(() => { busy = Math.max(0, busy - 1); if (o.onend) o.onend(); });
      return { native: true };
    }
    if (!web()) { if (o.onend) o.onend(); return null; }
    if (o.interrupt) speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    if (o.lang) u.lang = o.lang;
    if (o.voice) { u.voice = o.voice; if (!o.lang) u.lang = o.voice.lang; }
    if (o.pitch != null) u.pitch = Math.max(0.1, Math.min(2, o.pitch));
    if (o.rate != null) u.rate = o.rate;
    if (o.onend) { u.onend = o.onend; u.onerror = o.onend; }
    speechSynthesis.speak(u);
    return { u };
  }
  function cancel() {
    if (useNative()) { gen++; chain = Promise.resolve(); try { plugin().stop(); } catch { } }
    else if (web()) speechSynthesis.cancel();
  }
  const speaking = () => (useNative() ? busy > 0 : !!(web() && speechSynthesis.speaking));
  const openInstall = () => { try { plugin().openInstall(); } catch { } };
  return { available, isNative: useNative, voices, speak, cancel, speaking, onVoices, openInstall, reload: () => (useNative() ? loadNative() : null), loaded: () => loaded };
})();
