//
//  TrialTrackerApp.swift
//  watchOS app entry point (Phase 1: logging + reminders + complication + sync).
//

import SwiftUI
import UserNotifications

@main
struct TrialTrackerApp: App {
    @WKApplicationDelegateAdaptor(AppDelegate.self) private var delegate
    @StateObject private var store = EventStore()

    var body: some Scene {
        WindowGroup {
            HomeView()
                .environmentObject(store)
                .onAppear {
                    NotificationManager.shared.attach(store: store)
                    NotificationManager.shared.requestAuthorization()
                    NotificationManager.shared.rescheduleDoseReminders(settings: store.settings)
                    PhoneConnector.shared.activate()
                }
        }
    }
}

final class AppDelegate: NSObject, WKApplicationDelegate {
    func applicationDidFinishLaunching() {
        UNUserNotificationCenter.current().delegate = NotificationManager.shared
    }
}
