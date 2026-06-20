# Trial Tracker

A personal, private tracker for a clinical-trial medication — built for an
iPhone. It logs **when you take your dose** (with your 300 mg × 2/day schedule,
4-hour flex window, and 2-hour no-food cutoff), **side effects** (type, time,
1–10 intensity), and **free-form notes** like "got the chills" with an optional
body-temperature reading.

Everything is stored **on your phone only** (in the browser's local storage).
Nothing is sent anywhere unless *you* tap Export.

> ⚕️ This is a personal logging tool, not medical advice or an approved medical
> device. Always follow your study team's instructions; share your exported log
> with them.

---

## What it does

| Feature | Where |
|---|---|
| Next-dose countdown, flex window, and "stop eating by…" fasting cue | **Today** |
| One-tap **Log dose** (time auto-fills to now) | **Today** |
| **Side effect** logger — pick a type, set a 1–10 intensity, auto time/date | **Today** |
| **Note an observation** — free text + optional body temperature (°F/°C) | **Today** |
| **Stand-up detector** — prompts "feeling lightheaded?" when you rise (see caveat) | **Today** |
| Full grouped history, filterable by doses / side effects / notes | **History** |
| 7-day adherence %, side-effect counts, average intensity | **Stats** |
| **Export CSV** (for your coordinator) and **JSON backup** | **Stats** |
| Edit dose times, dose count, flex hours, fasting hours, side-effect list | **Settings** |

---

## 1. Put it on your iPhone (3 minutes)

The app needs to be served over **HTTPS** for the home-screen install, offline
mode, and motion permission to work. The easiest free host is **GitHub Pages**.

### Host it with GitHub Pages
1. Push this repo to GitHub (the `tracker/` folder is what we'll serve).
2. On GitHub: **Settings → Pages**.
3. Under *Build and deployment*, set **Source = Deploy from a branch**, pick your
   branch, folder **`/ (root)`**, and **Save**.
4. After a minute, your app is live at:
   `https://<your-username>.github.io/<repo>/tracker/`
   (for this repo: `https://usc513.github.io/json/tracker/`)

### Add to Home Screen
1. Open that URL in **Safari** on your iPhone.
2. Tap the **Share** button → **Add to Home Screen** → **Add**.
3. Launch it from the new icon. It now runs full-screen like an app and works
   offline.

---

## 2. Daily use

- **Taking your dose?** Open the app → **Log dose now**. The time is pre-filled
  to the current moment; just confirm. The Today card shows your next dose, the
  flex window, and when to stop eating beforehand.
- **Felt a side effect?** Tap **Log a side effect**, choose the type (or type a
  new one), drag the 1–10 slider, save. Time/date auto-fill.
- **An observation to track?** Tap **Add a note** — e.g. tag *Chills* + enter a
  temperature your doctor asked you to watch.
- **Sharing with your trial team?** **Stats → Export CSV** opens a clean
  spreadsheet of every entry. Use **Export JSON** periodically as a backup
  (and **Import backup** on a new phone).

---

## 3. Getting nudged so you don't forget

The most dependable reminders on iPhone come from **Apple Shortcuts**, not from
the web. Web notifications on iOS are unreliable for *scheduled* alerts, so set
up a couple of free, native automations:

### A. Twice-daily dose reminder
1. Open the **Shortcuts** app → **Automation** tab → **+** → **Create Personal
   Automation**.
2. Choose **Time of Day**, set it to your **first dose time** (e.g. 8:00 AM),
   **Daily**, and turn on **Run Immediately** (so it fires without a tap).
3. **Add Action** → search **Show Notification** → text:
   *"Time for your trial dose (300 mg). Open Trial Tracker to log it."*
4. *(Optional, opens the logger for you)* add an **Open URLs** action with:
   `https://<your-username>.github.io/<repo>/tracker/?quick=dose`
5. **Done.** Repeat steps 1–4 for your **second dose time** (e.g. 8:00 PM).

> The app understands special links so a Shortcut can jump you straight to a task:
> - `…/tracker/?quick=dose` — opens the **Log dose** sheet
> - `…/tracker/?quick=dose&confirm=1` — logs a dose **instantly**, no taps
> - `…/tracker/?quick=se` — opens the **side-effect** logger
> - `…/tracker/?quick=note` — opens the **note** logger

### B. Fasting heads-up (no food 2 hours before)
Add another Time automation **2 hours before** each dose with a notification
like *"Fasting window — stop eating now so you can take your dose at 8:00."*

### C. Side-effect / "how are you feeling?" check-ins
Add a Time automation (say, mid-morning and evening) with **Show Notification**
*"Any side effects to log?"* and optionally **Open URL** `…?quick=se`.

---

## 4. The "detect when I stand up and ask if I'm lightheaded" idea

You asked a great question about using the accelerometer to catch the
lightheaded-on-standing moments. Here's the honest landscape:

**What's built in (works today):** the **Stand-up detector** toggle on the Today
screen. Turn it on (Safari will ask for *Motion & Orientation* permission) and,
**while the app is open**, a sudden rise from sitting triggers a prompt: *"Feeling
lightheaded?"* → rate it 1–10, which logs a side effect with the time filled in.

**The hard limit:** neither a web app **nor** Apple Shortcuts can read the
accelerometer **in the background**. iOS suspends web pages and doesn't expose a
"sudden motion" trigger to Shortcuts. So passive, all-day detection while the
phone is in your pocket is **not** possible without a true native app.

**Practical options, best to simplest:**
1. **Use the in-app detector at known moments** — when you've been sitting a
   while and are about to get up, have the app open. It'll catch the rise.
2. **Apple Watch** — if you have one, it *can* monitor motion in the background;
   a native Watch app (or third-party fall/standing apps) is the only way to get
   true passive standing detection. This web app can't do that part.
3. **A recurring Shortcut check-in** (section C above) — simplest reliable
   coverage: a couple of taps a day to log any lightheadedness, no sensors needed.

For most people, **option 3 + the in-app detector** captures the data your study
team needs without a custom native app.

---

## 5. Customizing

Open **Settings** in the app to change dose amount, doses per day, target times,
flex hours, fasting hours, and the list of side-effect quick-buttons. Note tags
(Chills, Temperature check, Fever, Mood, etc.) live at the top of `app.js` in the
`NOTE_TAGS` array if you want to tailor them.

## 6. Privacy & data

- All entries live in your browser's `localStorage` on **this device only**.
- No account, no analytics, no network calls (the app even works in Airplane
  mode once installed).
- **Back up regularly** with *Stats → Export JSON*. Clearing Safari website data
  or deleting the home-screen app will erase your log, so keep exports.

## Files

```
tracker/
  index.html            app shell + sheets
  styles.css            styling
  app.js                all logic (storage, schedule, logging, export, motion)
  manifest.webmanifest  PWA metadata (home-screen install)
  sw.js                 service worker (offline)
  icon.svg              app icon
  README.md             this file
```
