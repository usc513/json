//
//  TrialEvent.swift
//  TrialKit — shared model used by the watchOS app (and an optional iOS companion).
//
//  This mirrors the web app's event schema (tracker/app.js) so CSV/JSON exports
//  line up across phone and watch.
//

import Foundation

public enum EventType: String, Codable {
    case dose
    case sideEffect
    case note
    case meal
}

public struct TrialEvent: Codable, Identifiable, Equatable {
    public var id: String
    public var type: EventType
    public var ts: Date

    // dose
    public var mg: Int?

    // sideEffect
    public var kind: String?        // e.g. "Lightheaded"
    public var intensity: Int?      // 1...10

    // note
    public var text: String?
    public var tags: [String]?
    public var temp: Double?
    public var tempUnit: String?    // "F" | "C"

    // meal
    public var food: String?
    public var amount: String?      // "Small" | "1 cup" | ...

    // provenance — handy when analyzing watch vs phone entries
    public var source: String?      // "watch.manual" | "watch.standup" | "watch.shortcut"

    public init(type: EventType,
                ts: Date = Date(),
                mg: Int? = nil,
                kind: String? = nil,
                intensity: Int? = nil,
                text: String? = nil,
                tags: [String]? = nil,
                temp: Double? = nil,
                tempUnit: String? = nil,
                food: String? = nil,
                amount: String? = nil,
                source: String? = "watch.manual") {
        self.id = UUID().uuidString
        self.type = type
        self.ts = ts
        self.mg = mg
        self.kind = kind
        self.intensity = intensity
        self.text = text
        self.tags = tags
        self.temp = temp
        self.tempUnit = tempUnit
        self.food = food
        self.amount = amount
        self.source = source
    }
}

public extension TrialEvent {
    /// One CSV row matching the web app's columns:
    /// date,time,type,detail,intensity_1_10,amount_mg,temperature,note
    func csvRow(calendar: Calendar = .current) -> [String] {
        let d = calendar.dateComponents([.year, .month, .day, .hour, .minute], from: ts)
        let date = String(format: "%04d-%02d-%02d", d.year ?? 0, d.month ?? 0, d.day ?? 0)
        let time = String(format: "%02d:%02d", d.hour ?? 0, d.minute ?? 0)

        let typeLabel: String
        let detail: String
        var intensityStr = ""
        var mgStr = ""
        var tempStr = ""
        var noteStr = ""

        switch type {
        case .dose:
            typeLabel = "Dose"; detail = "Medication"
            mgStr = mg.map(String.init) ?? ""
            noteStr = text ?? ""
        case .sideEffect:
            typeLabel = "Side effect"; detail = kind ?? ""
            intensityStr = intensity.map(String.init) ?? ""
            noteStr = text ?? ""
        case .note:
            typeLabel = "Note"
            detail = (tags?.isEmpty == false) ? tags!.joined(separator: "; ") : "Observation"
            if let t = temp { tempStr = "\(t)°\(tempUnit ?? "F")" }
            noteStr = text ?? ""
        case .meal:
            typeLabel = "Meal"; detail = food ?? "Food"
            noteStr = amount ?? ""
        }

        return [date, time, typeLabel, detail, intensityStr, mgStr, tempStr, noteStr]
    }
}
