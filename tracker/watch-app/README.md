# Trial Tracker — watchOS Phase 1 starter (source files)

These are **Swift source files**, not a buildable Xcode project (building watchOS
needs a Mac + Xcode). Drop them into a new project to get a working **Phase 1**
watch app: wrist logging, actionable dose reminders, a watch-face complication,
and one-way sync to an iPhone companion. Motion/stand-up detection is **Phase 2**
(see `../WATCH_APP_SPEC.md`); the rating UI it will reuse (`RateLightheadedView`)
is already here.

## What's included

```
watch-app/
  TrialKit/                 shared model + logic (add to both targets)
    TrialEvent.swift        event model — mirrors the web app schema (+ CSV row)
    TrialSettings.swift     dose schedule / fasting settings
    EventStore.swift        App Group JSON store + CSV export
    Schedule.swift          next-dose / flex-window / fasting-cutoff logic
  Watch/                    watchOS app target
    TrialTrackerApp.swift   @main entry; wires notifications + connectivity
    HomeView.swift          next-dose card + log buttons + today's list
    LogViews.swift          Dose / Side effect / Food / Note + lightheaded rating
    NotificationManager.swift  local actionable dose + fasting reminders
    PhoneConnector.swift    WatchConnectivity → iPhone companion
  Complication/
    TrialWidget.swift       WidgetKit complication (its own Widget Extension target)
```

## Create the Xcode project (≈10 min)

1. **File ▸ New ▸ Project ▸ watchOS ▸ App** (SwiftUI, watchOS 10+). Name it
   `TrialTracker`.
2. Add a **Widget Extension** target for the complication.
3. Add the files above to the matching targets:
   - `TrialKit/*` → **both** the watch app and the widget extension (check both
     in the file inspector's *Target Membership*).
   - `Watch/*` → watch app target.
   - `Complication/TrialWidget.swift` → widget extension only.
4. **Signing & Capabilities** (watch app target):
   - **App Groups** → add `group.com.yourname.trialtracker` and set the same id in
     `EventStore.appGroup`. Add the same group to the widget extension.
   - **Background Modes** is only needed for Phase 2 (Workout processing).
5. **Info.plist** — add `NSMotionUsageDescription` and the HealthKit strings now
   if you plan to continue to Phase 2 (see the spec).
6. Build to the watch simulator or your own Apple Watch.

## Notes

- **Data stays on device**, mirrored to the App Group container. The optional
  iOS companion can read that container and call `EventStore.exportCSV()` — the
  columns match the web app, so you can merge phone + watch logs.
- Replace `group.com.yourname.trialtracker` everywhere with your real group id.
- This compiles against watchOS 10 APIs (`WKApplicationDelegateAdaptor`,
  `NavigationStack`, WidgetKit accessory families). Adjust if you target older.
- To wire the Phase 2 stand-up prompt later: present `RateLightheadedView` from
  the stand-up local notification's handler in `NotificationManager`.
```
