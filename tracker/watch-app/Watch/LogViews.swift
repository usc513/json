//
//  LogViews.swift
//  The four quick-log flows, plus the lightheaded rating sheet reused by Phase 2.
//

import SwiftUI

// MARK: - Dose

struct DoseLogView: View {
    @EnvironmentObject var store: EventStore
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        VStack(spacing: 10) {
            Text("Log \(store.settings.mg)mg dose?").multilineTextAlignment(.center)
            Text(Date(), style: .time).font(.title3.bold())
            Button {
                store.add(TrialEvent(type: .dose, mg: store.settings.mg))
                WKInterfaceDevice.current().play(.success)
                dismiss()
            } label: { Label("Confirm", systemImage: "checkmark").frame(maxWidth: .infinity) }
                .tint(.blue)
        }
        .padding()
        .navigationTitle("Dose")
    }
}

// MARK: - Side effect (+ reusable rating)

struct SideEffectView: View {
    @EnvironmentObject var store: EventStore
    @Environment(\.dismiss) private var dismiss

    @State private var kind: String = ""
    @State private var intensity: Double = 5

    var body: some View {
        Form {
            Picker("Type", selection: $kind) {
                Text("Choose…").tag("")
                ForEach(store.settings.seTypes, id: \.self) { Text($0).tag($0) }
            }
            IntensityPicker(value: $intensity)
            Button("Save") {
                guard !kind.isEmpty else { return }
                store.add(TrialEvent(type: .sideEffect, kind: kind, intensity: Int(intensity)))
                WKInterfaceDevice.current().play(.success)
                dismiss()
            }
            .disabled(kind.isEmpty)
        }
        .navigationTitle("Side effect")
    }
}

/// Digital-Crown driven 1–10 picker, reused by the Phase 2 stand-up prompt.
struct IntensityPicker: View {
    @Binding var value: Double

    var body: some View {
        VStack(alignment: .leading) {
            Text("Intensity: \(Int(value))/10").font(.footnote)
            Text(Int(value) <= 1 ? "barely noticeable" : (Int(value) >= 10 ? "passed out" : " "))
                .font(.caption2).foregroundStyle(.secondary)
            Slider(value: $value, in: 1...10, step: 1)
                .focusable()
                .digitalCrownRotation($value, from: 1, through: 10, by: 1,
                                      sensitivity: .medium, isContinuous: false)
        }
    }
}

/// Standalone sheet the watch shows from a stand-up notification (Phase 2).
struct RateLightheadedView: View {
    @EnvironmentObject var store: EventStore
    @Environment(\.dismiss) private var dismiss
    @State private var intensity: Double = 3

    var body: some View {
        VStack(spacing: 8) {
            Text("Feeling lightheaded?").font(.headline)
            IntensityPicker(value: $intensity)
            HStack {
                Button("I'm fine") { dismiss() }.tint(.gray)
                Button("Save") {
                    store.add(TrialEvent(type: .sideEffect, kind: "Lightheaded",
                                         intensity: Int(intensity), source: "watch.standup"))
                    dismiss()
                }.tint(.orange)
            }
        }
        .padding()
    }
}

// MARK: - Meal / food

struct MealView: View {
    @EnvironmentObject var store: EventStore
    @Environment(\.dismiss) private var dismiss

    @State private var food: String = ""
    @State private var amount: String = ""
    private let portions = ["Bite", "Snack", "Small", "Medium", "Large"]

    var body: some View {
        Form {
            TextField("What did you eat?", text: $food)
            Picker("How much", selection: $amount) {
                Text("—").tag("")
                ForEach(portions, id: \.self) { Text($0).tag($0) }
            }
            Button("Save") {
                guard !food.isEmpty || !amount.isEmpty else { return }
                store.add(TrialEvent(type: .meal, food: food.isEmpty ? "Food" : food,
                                     amount: amount))
                WKInterfaceDevice.current().play(.success)
                // Warn if eating inside the fasting window before the next dose.
                let sched = Schedule(settings: store.settings, events: store.events)
                if let cut = sched.fastingCutoff(), Date() >= cut {
                    WKInterfaceDevice.current().play(.failure)
                }
                dismiss()
            }
            .disabled(food.isEmpty && amount.isEmpty)
        }
        .navigationTitle("Food")
    }
}

// MARK: - Note

struct NoteView: View {
    @EnvironmentObject var store: EventStore
    @Environment(\.dismiss) private var dismiss

    @State private var text: String = ""
    @State private var temp: Double = 98.6
    @State private var includeTemp = false
    @State private var tags: Set<String> = []
    private let tagOptions = ["Chills", "Temperature check", "Fever", "Mood", "Appetite"]

    var body: some View {
        Form {
            Section("Tags") {
                ForEach(tagOptions, id: \.self) { t in
                    Button {
                        if tags.contains(t) { tags.remove(t) } else { tags.insert(t) }
                        if t == "Temperature check" { includeTemp = tags.contains(t) }
                    } label: {
                        HStack {
                            Text(t)
                            Spacer()
                            if tags.contains(t) { Image(systemName: "checkmark") }
                        }
                    }
                }
            }
            TextField("Note", text: $text)
            Toggle("Body temperature", isOn: $includeTemp)
            if includeTemp {
                VStack(alignment: .leading) {
                    Text(String(format: "%.1f °F", temp)).font(.footnote)
                    Slider(value: $temp, in: 95...106, step: 0.1)
                        .focusable()
                        .digitalCrownRotation($temp, from: 95, through: 106, by: 0.1,
                                              sensitivity: .low, isContinuous: false)
                }
            }
            Button("Save") {
                store.add(TrialEvent(type: .note,
                                     text: text.isEmpty ? nil : text,
                                     tags: tags.isEmpty ? nil : Array(tags),
                                     temp: includeTemp ? (temp * 10).rounded() / 10 : nil,
                                     tempUnit: includeTemp ? "F" : nil))
                WKInterfaceDevice.current().play(.success)
                dismiss()
            }
            .disabled(text.isEmpty && tags.isEmpty && !includeTemp)
        }
        .navigationTitle("Note")
    }
}
