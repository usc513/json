//
//  EventStore.swift
//  TrialKit — on-device JSON store, mirrored to an App Group container so an
//  optional iOS companion can read/export the same data.
//

import Foundation
import Combine

public final class EventStore: ObservableObject {
    @Published public private(set) var events: [TrialEvent] = []
    @Published public var settings: TrialSettings = .default

    /// Set this to your real App Group id in both targets' entitlements.
    public static let appGroup = "group.com.yourname.trialtracker"

    private let eventsFile = "events.json"
    private let settingsFile = "settings.json"

    public init() {
        load()
    }

    private var containerURL: URL {
        FileManager.default
            .containerURL(forSecurityApplicationGroupIdentifier: Self.appGroup)
            ?? FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
    }

    // MARK: - Mutations

    public func add(_ event: TrialEvent) {
        events.append(event)
        persistEvents()
        PhoneConnector.shared.send(event: event)   // best-effort sync to iPhone
    }

    public func delete(_ event: TrialEvent) {
        events.removeAll { $0.id == event.id }
        persistEvents()
    }

    public func events(on day: Date, calendar: Calendar = .current) -> [TrialEvent] {
        events.filter { calendar.isDate($0.ts, inSameDayAs: day) }
              .sorted { $0.ts > $1.ts }
    }

    // MARK: - Persistence

    private func persistEvents() {
        write(events, to: eventsFile)
    }

    public func persistSettings() {
        write(settings, to: settingsFile)
    }

    private func load() {
        if let e: [TrialEvent] = read(eventsFile) { events = e }
        if let s: TrialSettings = read(settingsFile) { settings = s }
    }

    private func write<T: Encodable>(_ value: T, to file: String) {
        let enc = JSONEncoder()
        enc.dateEncodingStrategy = .iso8601
        guard let data = try? enc.encode(value) else { return }
        try? data.write(to: containerURL.appendingPathComponent(file), options: .atomic)
    }

    private func read<T: Decodable>(_ file: String) -> T? {
        let url = containerURL.appendingPathComponent(file)
        guard let data = try? Data(contentsOf: url) else { return nil }
        let dec = JSONDecoder()
        dec.dateDecodingStrategy = .iso8601
        return try? dec.decode(T.self, from: data)
    }

    // MARK: - Export (used by the optional iOS companion)

    public func exportCSV() -> String {
        let header = ["date", "time", "type", "detail",
                      "intensity_1_10", "amount_mg", "temperature", "note"]
        func cell(_ v: String) -> String {
            v.contains(where: { ",\"\n".contains($0) })
                ? "\"\(v.replacingOccurrences(of: "\"", with: "\"\""))\"" : v
        }
        var rows = [header.map(cell).joined(separator: ",")]
        for e in events.sorted(by: { $0.ts < $1.ts }) {
            rows.append(e.csvRow().map(cell).joined(separator: ","))
        }
        return rows.joined(separator: "\n")
    }
}
