//
//  TrialWidget.swift
//  Watch-face complication (WidgetKit, watchOS 9+). Shows next dose time, or
//  "Due" when inside the flex window. Add this file to a Widget Extension target.
//

import WidgetKit
import SwiftUI

struct TrialEntry: TimelineEntry {
    let date: Date
    let label: String   // "8:00 PM" or "Due"
}

struct TrialProvider: TimelineProvider {
    func placeholder(in context: Context) -> TrialEntry { TrialEntry(date: .now, label: "8:00") }

    func getSnapshot(in context: Context, completion: @escaping (TrialEntry) -> Void) {
        completion(entry())
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<TrialEntry>) -> Void) {
        // Refresh every 15 minutes; the store is read from the shared App Group.
        let next = Calendar.current.date(byAdding: .minute, value: 15, to: .now) ?? .now
        completion(Timeline(entries: [entry()], policy: .after(next)))
    }

    private func entry() -> TrialEntry {
        let store = EventStore()   // reads shared container
        let sched = Schedule(settings: store.settings, events: store.events)
        switch sched.status() {
        case .upcoming(let t):
            return TrialEntry(date: .now, label: t.formatted(date: .omitted, time: .shortened))
        case .dueNow:    return TrialEntry(date: .now, label: "Due")
        case .overdue:   return TrialEntry(date: .now, label: "Late")
        case .none:      return TrialEntry(date: .now, label: "—")
        }
    }
}

struct TrialComplicationView: View {
    var entry: TrialEntry
    var body: some View {
        VStack(spacing: 0) {
            Image(systemName: "pills.fill").font(.caption2)
            Text(entry.label).font(.caption2.bold()).minimumScaleFactor(0.6)
        }
    }
}

@main
struct TrialWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "TrialNextDose", provider: TrialProvider()) { entry in
            TrialComplicationView(entry: entry)
        }
        .configurationDisplayName("Next dose")
        .description("Shows your next trial dose time.")
        .supportedFamilies([.accessoryCircular, .accessoryCorner, .accessoryInline])
    }
}
