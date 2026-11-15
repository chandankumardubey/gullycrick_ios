# Gully Scorer v4 – ball-by-ball gully cricket scoring (offline, no login)

## New in v4: Commentary studio (Home → 🎙 Commentary studio, or Match menu)
- **38 commentary events**: dot, 1/2/3/5 runs, four, six, wide, no ball, byes, leg byes, free hit,
  every dismissal (bowled, caught, caught & bowled, LBW, run out, stumped, hit wicket, one tip one hand, hit outside),
  fifty, hundred, partnerships, team 50/100, hat-trick, 3/5-wicket hauls, maiden, end of over, chase equation,
  new batter, toss, innings break, won chasing, won defending, tie, Super Over, Player of the Match.
- **English and Hindi (Devanagari)** – spoken: English / हिन्दी / Both with a Hindi-share slider; written scorecard: English / हिन्दी / Mixed.
- **Male / female Indian voices** – Male / Female / Both with a "chance of female voice per line" slider, speed and pitch.
  Voices are auto-detected (e.g. Microsoft Ravi/Heera/Hemant/Kalpana, Edge natural voices, Google Hindi); tag any voice as male/female
  yourself, test it with ▶. If a phone has no male (or female) voice for a language, it is imitated by changing pitch.
- **3 commentator styles** mixed by sliders: *Classic* (TV-style), *Paaji* (loud, funny desi one-liners), *Silk* (calm, elegant analyst).
  The styles are original characters written for the app, inspired by popular Indian commentary flavours.
- **Variety**: one global "variations per event" number (default **50**, up to ~530 unique lines per event per language),
  plus an optional **count per event**. "New set of variations" reshuffles everything.
- **Randomness** slider: 0% = goes through the variations in order (no repeat until all used), 100% = fully random (still avoids recent lines).
- **Per-event editor**: see every line, hear it, ✕ remove it (auto-replaced), add your own lines with placeholders, restore removed.
- **What to say**: switch dot balls, singles, over summaries, chase equation and the score read-out on/off.

How lines are built: [style opener] + [event line] + [style tail] → 5 event lines × 6 openers × 6 tails per style per language,
all unique. Placeholders: {bt} batter, {bw} bowler, {f} fielder, {zone}, {r} runs, {n} number, {b} balls, {team}, {opp}, {score}, {p} player.

### Getting good Indian voices on Android
Settings → System → Languages → Text-to-speech output → Google → ⚙ → Install voice data → install **English (India)** and **Hindi (India)**;
each offers several male and female voices. Chrome uses whatever is installed.

## Earlier features
Ball-by-ball scoring with gully rules, undo, free hits, Super Overs · scorecards, image/PDF/link/QR sharing · live score link ·
achievements, streaks, rivalries, head-to-head · balanced Team maker with weightage, locks and selective reshuffle ·
auto ratings from form · tournaments (league, NRR, semis/final, Player of the Series) · voice scoring · wagon wheel ·
two-phone handover · “Who's in?” availability polls · backup/merge/cloud sync.

## Run / install
1. Host this folder on any HTTPS static host (GitHub Pages, Netlify, Azure Static Web Apps, IIS). Local test: `npx serve .`
2. Open on the phone → **Add to Home screen**. Works offline after the first load.
3. Settings → **Public app URL** = your hosted URL (needed for links/QRs).

## Free server for live score, handover, polls & cloud sync (optional)
Firebase console → Realtime Database → create. Rules:
```json
{ "rules": {
    "gully":      { "$code": { ".read": true, ".write": true } },
    "gully-sync": { "$code": { ".read": true, ".write": true } },
    "gully-poll": { "$code": { ".read": true, ".write": true } } } }
```
Paste the database URL into Settings → **Live/sync server URL**.

## Android APK (Capacitor) – Node 24 / npm 11
```
npm init -y
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap init "Gully Scorer" com.yourorg.gullyscorer --web-dir www
mkdir www
copy index.html,styles.css,engine.js,qr.js,comm-data.js,core.js,comm.js,teammaker.js,tournament.js,extras.js,app.js,sw.js,manifest.webmanifest www\
xcopy icons www\icons\ /E
npx cap add android
npx cap sync android
npx cap open android
```
Add `<uses-permission android:name="android.permission.RECORD_AUDIO" />` to AndroidManifest.xml for voice scoring.
Spoken commentary uses the Android WebView's speech engine; if it is silent inside the APK on some phones, install the
`@capacitor-community/text-to-speech` plugin (the app works unchanged as a home-screen web app in Chrome).

## Files
| File | Purpose |
|---|---|
| engine.js | Scoring engine (event-log replay → exact Undo), shot zones |
| comm-data.js | Commentary phrase bank: 38 events × English/Hindi, 3 styles × 6 moods |
| comm.js | Variation pools, randomness, language/voice choice, speech, Commentary studio |
| core.js | Storage, results, stats, achievements, commentary events, image/PDF, links, live, handover, polls, sync |
| teammaker.js · tournament.js · extras.js · qr.js | Team maker · tournaments · voice input, wagon wheel, polls, handover · QR codes |
| app.js | Screens, sheets, actions, boot |



## v4.1 additions
- **Coin toss**: on the New match screen choose who calls Heads/Tails, tap *Flip the coin* (animated, secure random). The winner is filled in automatically; they then pick Bat or Bowl. Manual selection still works, and the coin result is stored with the match.
- **Start with just team names**: leave the player boxes blank (set a head-count) and start scoring straight away. Players are created as placeholders ("Team 1", "Team 2"...).
- **Edit players on the fly**: Match menu -> *Edit / add players* (also a button in the openers / next batter / bowler sheets). Rename any player, add new ones, or remove players who haven't played yet. Renaming a placeholder gives it a real identity and it then counts in career stats; typing an existing player's name links to that player for this match. Adding a player to an "all out" side lets the innings continue.


## v4.2 additions
- **Team maker pool**: a 🗑 on every player (individual delete) and *Select players* mode for bulk delete (All / None / Not playing). Deleting is soft: past matches and stats stay, and *Removed players* lets you restore (or erase if they have no history). Typing a removed name restores that player.
- **Linked players**: tag 2+ players as *Keep apart* (spread across both teams; a pair is always split) or *Keep together*. Team making, reshuffle and fit-new-players all respect links. Manual moves / locks can still override – the conflict is flagged, asked about on match start and recorded in the match audit.
- **Adjust score (audited)**: Match menu -> *Adjust score / overs / player scores*. Type the correct team runs / wickets / overs, any batter's R-B-4s-6s (or mark them out), any bowler's O-R-W, and optionally who is at the crease. Each adjustment needs a reason, is appended to the log (nothing is rewritten), updates a chase target if needed and appears under *Audit log*. Review with Approve / Revert (revert adds a reversing entry). The scoring screen shows a notice while adjustments are unreviewed, finishing the match offers a review, and scorecards / share text say "includes manual adjustments". Player renames, replacements, additions and removals are logged too.
- **Solo battle**: Home -> Solo battle. Pick players, overs each and the out rule; the batting order is drawn at random (shuffle / reorder / drop). Highest score wins; ties can be settled with a 1-over tie-break. Next round: everyone, top 3, or without the winner, ordered random / lowest first / best first / same. Series standings, undo, share, and the same audited score adjustments.
- **Voice read-back**: after every voice-scored ball the app shows what it heard and understood, speaks it back ("Four runs for Rohit. Rohit 27 off 14. Score 45 for 2, 3.4 overs.") and offers a one-tap *Wrong? Undo*. Settings -> Voice read-back: record-then-read-back (default), ask first and record only on "yes" (or the buttons), or silent on-screen log. The microphone is muted while the app speaks. Works in solo battles too. In the Android / iOS apps listening and speaking use native plugins.

## v4.3 – commentary voice in the Android / iOS apps
The Android WebView has no `speechSynthesis`, which is why the first APK showed text commentary but said "This browser cannot speak". A new `tts.js` layer now speaks through the phone's own text-to-speech engine (Capacitor Text-to-Speech plugin) in the apps and through the browser engine elsewhere. Commentary, the Commentary studio (voice list, ▶ test, demo over, Hindi / English, male / female) and the voice read-back all use it. In the studio, *Install / manage voices* opens Android's voice installer and *Refresh* re-reads the voice list.
If Hindi is silent: Android Settings -> System -> Languages -> Text-to-speech output -> (Google engine) -> Install voice data -> Hindi (India).
