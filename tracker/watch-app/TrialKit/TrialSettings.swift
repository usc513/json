//
//  TrialSettings.swift
//  TrialKit
//

import Foundation

public struct TrialSettings: Codable, Equatable {
    public var mg: Int
    public var perDay: Int
    public var times: [String]      // "HH:mm" target times
    public var flexHours: Double
    public var fastHours: Double
    public var seTypes: [String]

    public static let `default` = TrialSettings(
        mg: 300,
        perDay: 2,
        times: ["08:00", "20:00"],
        flexHours: 4,
        fastHours: 2,
        seTypes: ["Lightheaded", "Dizzy", "Nausea", "Headache",
                  "Fatigue", "Rash", "Stomach pain", "Trouble sleeping"]
    )

    public init(mg: Int, perDay: Int, times: [String],
                flexHours: Double, fastHours: Double, seTypes: [String]) {
        self.mg = mg; self.perDay = perDay; self.times = times
        self.flexHours = flexHours; self.fastHours = fastHours; self.seTypes = seTypes
    }
}
