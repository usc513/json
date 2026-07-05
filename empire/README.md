# 👑 Empire

A phone-friendly app for running the party game **Empire**. As each person stands up
and says their word (any word they like), you type it in. When everyone has gone, tap
**Scramble & Read** — the app shuffles the order and reads the whole list aloud
**slowly, twice**, so the whole room hears the pool of words before the guessing begins.

## How to play with it

It's a **pass-the-phone** app — no one ever sees anyone else's word until the reading.

1. Open the app and hand the phone around.
2. Each person types **their** word and taps **Done with my word**. The field clears and a
   "pass the phone 👉" prompt appears, so the next person never sees the previous entry.
   (Nothing is ever displayed back — the words are not listed anywhere on screen.)
3. When everyone's in, tap **Ready to start →**. A **15-second countdown** runs so you can
   pass the phone to the reader and let the room settle.
4. When the countdown hits zero the app **automatically reads the scrambled list aloud,
   slowly, twice**. Each word also shows big on screen.
   - **Skip & read now** jumps straight in; **Cancel** goes back to add more words.
   - Drag the 🐢–🐇 slider for reading speed; toggle 🔊 off to read them yourself.
   - **↻ Read Again** repeats; **Edit words** goes back to the collect screen.
5. When the round is over, tap **🔄 New game — clear all words** to wipe everything and
   start fresh for the next round.

The words are always **scrambled** into a random order before reading (guaranteed to
differ from the order they were entered). Your word list is saved on the device, so a
refresh won't lose it — only **New game** or **Clear all** clears it.

## Making the voice sound better

The app speaks with whatever voices are installed on your phone, and it automatically
picks the best-sounding one it can find. If it still sounds robotic:

- **In the app:** use the 🎙️ **voice dropdown** on the reading screen to try another voice
  (it previews each one as you pick, and remembers your choice).
- **Install a natural voice** (a one-time setting — makes the biggest difference):
  - **iPhone/iPad:** Settings → **Accessibility** → **Spoken Content** → **Voices** →
    **English** → pick a voice and tap the cloud icon to download the **Enhanced** or
    **Premium** version (e.g. *Samantha (Enhanced)*, *Ava (Premium)*). Reopen the app and
    choose it in the 🎙️ dropdown.
  - **Android:** Settings → **Accessibility** → **Text-to-speech output** → make sure
    **Google Text-to-speech** is the engine, then **Install voice data** → English and
    download the higher-quality voices.

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
