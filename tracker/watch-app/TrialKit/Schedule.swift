//
//  Schedule.swift
//  TrialKit — next-dose calculation, ported from the web app's logic.
//

import Foundation

public struct DoseSlot: Identifiable {
    public let id = UUID()
    public let index: Int
    public let time: Date
    public var taken: Bool
    public var takenAt: Date?
}

public enum DoseStatus {
    case upcoming(Date)     // target time in the future
    case dueNow(until: Date)
    case overdue(by: TimeInterval)
}

public struct Schedule {
    public let settings: TrialSettings
    public let events: [TrialEvent]
    public var calendar: Calendar = .current

    public init(settings: TrialSettings, events: [TrialEvent]) {
        self.settings = settings
        self.events = events
    }

    private func time(_ hhmm: String, on day: Date) -> Date? {
        let parts = hhmm.split(separator: ":").compactMap { Int($0) }
        guard parts.count == 2 else { return nil }
        return calendar.date(bySettingHour: parts[0], minute: parts[1], second: 0, of: day)
    }

    /// Scheduled dose times for a given day, sorted.
    public func scheduledDoses(on day: Date) -> [Date] {
        settings.times.compactMap { time($0, on: day) }.sorted()
    }

    private var doseEvents: [TrialEvent] { events.filter { $0.type == .dose } }

    private func isCovered(_ slot: Date) -> Bool {
        let flex = settings.flexHours * 3600 + 1800
        return doseEvents.contains { e in
            abs(e.ts.timeIntervalSince(slot)) <= flex &&
            calendar.isDate(e.ts, inSameDayAs: slot)
        }
    }

    /// The next dose target time the user still needs to take.
    public func nextDose(now: Date = Date()) -> Date? {
        var candidates: [Date] = []
        for offset in -1...1 {
            guard let day = calendar.date(byAdding: .day, value: offset, to: now) else { continue }
            candidates += scheduledDoses(on: day)
        }
        candidates.sort()
        let flex = settings.flexHours * 3600
        for c in candidates where !isCovered(c) {
            if c.addingTimeInterval(flex) >= now { return c }
        }
        return candidates.first { $0 > now }
    }

    public func status(now: Date = Date()) -> DoseStatus? {
        guard let target = nextDose(now: now) else { return nil }
        let windowEnd = target.addingTimeInterval(settings.flexHours * 3600)
        if target > now { return .upcoming(target) }
        if now <= windowEnd { return .dueNow(until: windowEnd) }
        return .overdue(by: now.timeIntervalSince(windowEnd))
    }

    /// When to stop eating before the next dose (nil if no fasting configured).
    public func fastingCutoff(now: Date = Date()) -> Date? {
        guard settings.fastHours > 0, let target = nextDose(now: now), target > now else { return nil }
        return target.addingTimeInterval(-settings.fastHours * 3600)
    }
}
