# 👑 Empire

A phone-friendly app for running the party game **Empire**. As each person stands up
and says their word (any word they like), you type it in. When everyone has gone, tap
**Scramble & Read** — the app shuffles the order and reads the whole list aloud
**slowly, twice**, so the whole room hears the pool of words before the guessing begins.

## How to play with it

1. Open the app on your phone.
2. As each person says their word, type it and tap **+** (or hit Return).
   - Turn on **Hide words as added** if you don't want people peeking at the list.
3. When everyone's in, tap **Scramble & Read →**.
4. Tap **▶︎ Read Aloud**. Each word shows big on screen and is spoken aloud; the whole
   scrambled list is read through twice.
   - Drag the 🐢–🐇 slider to set the reading speed.
   - Toggle 🔊 off if you'd rather read them yourself and just use the big display.
5. Tap **Edit words** to fix the list, or **↻ Read Again** for another pass.

Your word list is saved on the device, so a refresh won't lose it.

## Running it on your phone

This is a self-contained web app (one folder, no server, no build, works offline).
Pick whichever is easiest:

**A. Host it (easiest to share with a group)**
- Put this `empire/` folder anywhere that serves static files (GitHub Pages, Netlify,
  Vercel, etc.) and open the URL on your phone.
- Enable GitHub Pages on this repo and the app will be at
  `https://<your-user>.github.io/<repo>/empire/`.

**B. Open the file directly**
- Copy `empire/index.html` to your phone and open it in the browser. Voice reading
  needs the page served over `http(s)://` on some browsers, so if the 🔊 doesn't speak
  from a local file, use option A.

**C. Make it feel like a native app**
- Open the hosted URL in the phone browser, then **Add to Home Screen**. It gets its own
  crown icon and opens full-screen with no browser chrome — indistinguishable from a
  native app for game night.

## Notes on "native"

A true App Store / Play Store build needs Xcode / Android Studio and a developer account,
which you can't just run from a repo. This is a Progressive Web App instead: it installs
to the home screen, runs full-screen and offline, and uses your phone's built-in
text-to-speech — all the "native" feel with none of the store overhead. If you later want
a real store-listed build, the same `index.html` can be wrapped with Capacitor.

## Files

| File | Purpose |
|------|---------|
| `index.html` | The entire app (UI + logic) |
| `manifest.webmanifest` | Makes it installable to the home screen |
| `icon.png` | App icon (👑) |
