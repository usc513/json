//
//  NotificationManager.swift
//  Local, actionable dose reminders + fasting heads-up. No server / push needed.
//

import Foundation
import UserNotifications

final class NotificationManager: NSObject, UNUserNotificationCenterDelegate {
    static let shared = NotificationManager()
    private weak var store: EventStore?

    private let doseCategory = "DOSE_REMINDER"

    func attach(store: EventStore) { self.store = store }

    func requestAuthorization() {
        let center = UNUserNotificationCenter.current()
        center.requestAuthorization(options: [.alert, .sound]) { _, _ in }

        let taken = UNNotificationAction(identifier: "DOSE_TAKEN", title: "Taken ✓",
                                         options: [.authenticationRequired])
        let snooze = UNNotificationAction(identifier: "DOSE_SNOOZE", title: "Remind in 30m")
        let cat = UNNotificationCategory(identifier: doseCategory,
                                         actions: [taken, snooze],
                                         intentIdentifiers: [], options: [])
        center.setNotificationCategories([cat])
    }

    /// Schedule a repeating reminder at each dose time, plus a fasting heads-up.
    func rescheduleDoseReminders(settings: TrialSettings) {
        let center = UNUserNotificationCenter.current()
        center.removeAllPendingNotificationRequests()

        for (i, hhmm) in settings.times.enumerated() {
            let parts = hhmm.split(separator: ":").compactMap { Int($0) }
            guard parts.count == 2 else { continue }

            // Dose reminder
            var dc = DateComponents(); dc.hour = parts[0]; dc.minute = parts[1]
            schedule(id: "dose-\(i)",
                     title: "Trial dose",
                     body: "Time for your \(settings.mg)mg dose. Mark it taken.",
                     category: doseCategory,
                     dateComponents: dc)

            // Fasting heads-up (fastHours before)
            if settings.fastHours > 0 {
                let total = parts[0] * 60 + parts[1] - Int(settings.fastHours * 60)
                let norm = (total % 1440 + 1440) % 1440
                var fc = DateComponents(); fc.hour = norm / 60; fc.minute = norm % 60
                schedule(id: "fast-\(i)",
                         title: "Stop eating",
                         body: "No food now — dose at \(hhmm).",
                         category: nil,
                         dateComponents: fc)
            }
        }
    }

    private func schedule(id: String, title: String, body: String,
                          category: String?, dateComponents: DateComponents) {
        let content = UNMutableNotificationContent()
        content.title = title; content.body = body; content.sound = .default
        if let category { content.categoryIdentifier = category }
        let trigger = UNCalendarNotificationTrigger(dateMatching: dateComponents, repeats: true)
        UNUserNotificationCenter.current()
            .add(UNNotificationRequest(identifier: id, content: content, trigger: trigger))
    }

    // MARK: - Delegate

    func userNotificationCenter(_ center: UNUserNotificationCenter,
                                willPresent notification: UNNotification) async
        -> UNNotificationPresentationOptions { [.banner, .sound] }

    func userNotificationCenter(_ center: UNUserNotificationCenter,
                                didReceive response: UNNotificationResponse) async {
        switch response.actionIdentifier {
        case "DOSE_TAKEN":
            store?.add(TrialEvent(type: .dose, mg: store?.settings.mg, source: "watch.shortcut"))
        case "DOSE_SNOOZE":
            let content = UNMutableNotificationContent()
            content.title = "Trial dose"; content.body = "Reminder — mark your dose taken."
            content.categoryIdentifier = doseCategory
            let trigger = UNTimeIntervalNotificationTrigger(timeInterval: 1800, repeats: false)
            try? await UNUserNotificationCenter.current()
                .add(UNNotificationRequest(identifier: "dose-snooze-\(UUID().uuidString)",
                                           content: content, trigger: trigger))
        default: break
        }
    }
}
