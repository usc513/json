# Trial Tracker — Apple Watch App Spec

A build-ready sketch for a companion **watchOS app** that adds what a web app
can't: **wrist-tap logging** and **background stand-up detection** that prompts
you to rate lightheadedness. It shares the same data model as the web app
(`tracker/`) so your CSV export stays consistent.

> ⚕️ Personal logging aid, not a medical device. Detection is best-effort and
> always asks *you* to confirm/rate — it never diagnoses. Follow your study team.

---

## 1. What it adds over the web app

| Capability | Web app | Watch app |
|---|---|---|
| Log dose / side effect / note | ✅ | ✅ (one tap on wrist) |
| Reminders | via Shortcuts | ✅ native, actionable, haptic |
| Complication on watch face | ❌ | ✅ |
| **Background** stand-up detection → prompt | ❌ (foreground only) | ✅ (with caveats below) |
| Heart-rate corroboration of orthostatic events | ❌ | ✅ (HealthKit) |
| Data stays on-device | ✅ | ✅ |

---

## 2. Hard truths about watchOS background motion

Plan around these — they shape the whole architecture:

- **You cannot get continuous accelerometer streaming from a suspended app.**
  watchOS suspends apps aggressively. Two legitimate ways to keep sensors alive:
  1. **`HKWorkoutSession`** — run a custom workout in the background. This keeps
     motion *and* heart rate flowing and lets you react in real time. **Cost:
     battery + it occupies the "active workout" slot.**
  2. **`CMSensorRecorder`** — watchOS-only API that records raw accelerometer to
     a buffer (~12 h) at low power, which you query *later*. Great for
     retrospective analysis, but you **can't prompt at the exact moment**.
- **`WKExtendedRuntimeSession`** grants short, bounded background time for
  categories like `selfCare`/`mindfulness` — useful for periodic check-ins, not
  all-day streaming.
- **No public "sudden motion" trigger.** You build detection yourself from
  CoreMotion signals.
- **"Lightheadedness" is not measurable.** You can detect the *stand-up event*
  and a *heart-rate change*; the app still asks the user to rate 1–10.

**Design consequence:** a real-time prompt requires an active `HKWorkoutSession`.
Offer it as a user-toggled "Monitoring" mode (clearly battery-costing), and use
`CMSensorRecorder` as a low-power fallback for retrospective review.

---

## 3. Architecture

```
┌─────────────────────────────┐         WatchConnectivity         ┌──────────────────────────┐
│  watchOS app (SwiftUI)      │  ───  WCSession (events sync)  ──▶ │  iOS companion app       │
│                             │                                    │  (optional thin shell)   │
│  • Logging UI + complication│                                    │  • writes shared store   │
│  • Local notifications      │         App Group (shared)         │  • can open/seed web app │
│  • MotionMonitor (CoreMotion│  ◀───  shared JSON event log  ───▶ │                          │
│    + HealthKit HR)          │                                    └──────────────────────────┘
│  • Local event store        │
└─────────────────────────────┘
```

- **Language/UI:** Swift + SwiftUI, watchOS 10+ (single watch-app target).
- **Persistence:** a local JSON event log on the watch, mirrored to an **App
  Group** container so an optional iOS companion can read/export it. Same schema
  as the web app (§5).
- **Companion iOS app is optional.** The watch app can stand alone; the companion
  just makes exporting and interop with the web app easier.

---

## 4. Targets, capabilities, Info.plist

**Xcode targets**
- `TrialTrackerWatch` (watchOS App) — required.
- `TrialTracker` (iOS App) — optional companion for export/interop.
- Shared Swift package/folder `TrialKit` for the model + store (used by both).

**Capabilities**
- **HealthKit** (heart rate read).
- **Background Modes** → *Workout processing* (for `HKWorkoutSession`).
- **App Groups** → `group.com.yourname.trialtracker` (shared store).
- Push not required (everything is local notifications).

**Info.plist usage strings (required or the app crashes on request):**
- `NSMotionUsageDescription` — "Detects when you stand up to ask about
  lightheadedness."
- `NSHealthShareUsageDescription` — "Reads heart rate to corroborate
  light-headed episodes."
- `NSHealthUpdateUsageDescription` — (only if you write workouts to Health.)

---

## 5. Data model (matches the web app)

Keep these identical to `tracker/app.js` so a merged CSV/JSON is uniform.

```swift
enum EventType: String, Codable { case dose, sideEffect, note }

struct TrialEvent: Codable, Identifiable {
    var id: String = UUID().uuidString
    var type: EventType
    var ts: Date                    // ISO-8601 on export

    // dose
    var mg: Int? = nil

    // sideEffect
    var kind: String? = nil         // e.g. "Lightheaded"
    var intensity: Int? = nil       // 1...10

    // note
    var text: String? = nil
    var tags: [String]? = nil
    var temp: Double? = nil
    var tempUnit: String? = nil     // "F" | "C"

    // provenance (handy for analysis)
    var source: String? = nil       // "watch.manual" | "watch.standup" | "watch.shortcut"
}
```

Export rows map to the web app's CSV columns:
`date, time, type, detail, intensity_1_10, amount_mg, temperature, note`.

---

## 6. Screens (SwiftUI)

1. **Home** — next-dose label + countdown; big buttons: **Log dose**, **Side
   effect**, **Note**; a "Monitoring: On/Off" toggle.
2. **Rate sheet** (the core flow) — title "Feeling lightheaded?", a **Digital
   Crown–driven 1–10 picker**, Save / "I'm fine" buttons. Reached from the
   stand-up notification or the side-effect button.
3. **Quick note** — tag chips (Chills, Temperature check…) + optional Digital
   Crown temperature entry + dictation field.
4. **Today list** — compact log of today's events (mirrors the web "Logged
   today").
5. **Complication** — shows next dose time / "due now"; tap launches Home.

---

## 7. Reminders (local, actionable)

Use `UNUserNotificationCenter`. Define a category with quick actions so you can
log straight from the notification without opening the app.

```swift
let taken = UNNotificationAction(identifier: "DOSE_TAKEN", title: "Taken ✓")
let snooze = UNNotificationAction(identifier: "DOSE_SNOOZE", title: "Remind in 30m")
let cat = UNNotificationCategory(identifier: "DOSE_REMINDER",
            actions: [taken, snooze], intentIdentifiers: [])
center.setNotificationCategories([cat])
```

Schedule repeating `UNCalendarNotificationTrigger`s for each dose time, a
"stop eating" alert `fastHours` before, and optional side-effect check-ins.
Handle `DOSE_TAKEN` in the delegate by appending a `dose` event.

---

## 8. Stand-up detection (the interesting part)

**Strategy: layered signals, confirm with the user.** No single signal is
reliable on the wrist, so combine cheap ones and only prompt on agreement.

Signals:
- **Motion activity transition** (`CMMotionActivityManager`): `stationary` held
  for ≥ N minutes → then `walking`/`unknown` with motion ⇒ likely a sit→stand.
- **Relative altitude** (`CMAltimeter`): the wrist/body rising produces a small
  positive altitude delta within ~2 s.
- **Vertical acceleration impulse** (`CMMotionManager.deviceMotion`):
  `userAcceleration` projected onto `gravity` shows an upward spike.
- **Heart-rate response** (HealthKit): orthostatic standing often raises HR
  ~10–20 bpm within 15–30 s — strong corroboration, used to *rank* severity, not
  as a gate (don't miss events with a flat HR).

Only a live `HKWorkoutSession` (or extended runtime window) keeps these flowing
in the background.

```swift
final class MotionMonitor {
    private let motion = CMMotionManager()
    private let altimeter = CMAltimeter()
    private let activity = CMMotionActivityManager()
    private var stationarySince: Date?
    private var lastPrompt: Date = .distantPast

    func start() {
        // Started inside an active HKWorkoutSession so it runs in background.
        activity.startActivityUpdates(to: .main) { [weak self] act in
            guard let self, let act else { return }
            if act.stationary, act.confidence != .low { self.stationarySince = self.stationarySince ?? Date() }
            else if (self.stationarySince.map { Date().timeIntervalSince($0) > 120 } ?? false) {
                self.stationarySince = nil
                self.candidateStandUp()          // was sitting ≥2 min, now moving
            }
        }
        altimeter.startRelativeAltitudeUpdates(to: .main) { /* track Δaltitude */ _, _ in }
        motion.deviceMotionUpdateInterval = 1.0 / 25.0
        motion.startDeviceMotionUpdates(to: .main) { dm, _ in /* watch vertical accel spike */ }
    }

    private func candidateStandUp() {
        guard Date().timeIntervalSince(lastPrompt) > 25 else { return }   // debounce
        // require ≥2 of: altitude rise, vertical impulse, activity transition
        guard confidenceScore() >= 2 else { return }
        lastPrompt = Date()
        promptLightheaded()      // local notification + haptic .notification
    }
}
```

`promptLightheaded()` fires a haptic + a `UNNotificationRequest` (or, if app is
foreground, presents the Rate sheet). Tapping it opens the 1–10 picker and saves
a `sideEffect` event `kind: "Lightheaded", source: "watch.standup"`.

**Low-power fallback (no workout running):** every launch/foreground, pull the
last few hours from `CMSensorRecorder`, run the same heuristic offline, and add
any detected stand-ups as *unconfirmed* events the user can review and rate
later.

```swift
let recorder = CMSensorRecorder()
recorder.recordAccelerometer(forDuration: 12 * 3600)   // call periodically
if let data = recorder.accelerometerData(from: start, to: end) { /* analyze batches */ }
```

**Tuning notes:** start conservative (favor missed events over false prompts —
nuisance prompts kill adoption), make the debounce and the "stationary ≥ X min"
threshold user-tunable, and log every prompt outcome (rated / "I'm fine" /
ignored) to refine thresholds.

---

## 9. Sync & export

- **Watch → phone:** on each new event, `WCSession.transferUserInfo` (queued,
  survives the phone being asleep). Companion writes to the App Group store.
- **Export:** the iOS companion produces the same CSV as the web app. To unify
  with web-app data, import the watch JSON via the web app's **Import backup**
  (same schema) and export one combined CSV.
- **Standalone option:** if you skip the companion, add a "Share log" action on
  the watch that AirDrops/Mails the JSON.

---

## 10. Battery & UX guardrails

- Monitoring mode (`HKWorkoutSession`) **must** be an explicit toggle with a
  battery warning, ideally auto-limited to waking hours or a user schedule.
- Prefer the `CMSensorRecorder` retrospective path as the default; reserve the
  live workout session for periods the user opts into (e.g., "monitor for the
  next 3 hours").
- Cap prompts (e.g., ≤ 1 per 25 s and a sensible daily max).

---

## 11. Build phases (ship value early)

- **Phase 1 — Wrist logging (days, not weeks):** logging UI, actionable dose
  reminders, complication, `WCSession` sync. *No motion detection.* Delivers most
  of the day-to-day value immediately.
- **Phase 2 — Live detection:** `HKWorkoutSession` monitoring mode + layered
  stand-up heuristic + rate prompt.
- **Phase 3 — Corroboration & polish:** HealthKit HR ranking, `CMSensorRecorder`
  retrospective pass, threshold auto-tuning, schedule-aware monitoring.

---

## 12. Getting it on your wrist

- **Personal use:** free Apple ID lets you run it on your own devices from Xcode
  (7-day resign cycle). A paid **Apple Developer Program** (~$99/yr) enables
  **TestFlight** (90-day builds, no weekly resign) — best for ongoing personal
  use.
- **Requires a Mac with Xcode.** That's why it's a separate project from this web
  app, which needs none of that.
- If you want orthostatic data to be clinically meaningful, talk to your study
  team first about what they'd accept.

---

## 13. Minimal project checklist

- [ ] New Xcode project → watchOS App (SwiftUI), add iOS companion target.
- [ ] Add `TrialKit` shared folder with `TrialEvent` + a `JSONStore`.
- [ ] Enable HealthKit, Background Modes (Workout processing), App Groups.
- [ ] Add Info.plist usage strings (§4).
- [ ] Phase 1: logging views + `UNUserNotificationCenter` reminders + complication
      + `WCSession`.
- [ ] Phase 2: `MotionMonitor` inside an `HKWorkoutSession`; rate-sheet flow.
- [ ] Phase 3: HR query + `CMSensorRecorder` fallback + tuning UI.
- [ ] Verify CSV columns match `tracker/app.js`.
```
