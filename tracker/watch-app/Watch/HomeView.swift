//
//  HomeView.swift
//  Main wrist screen: next-dose status + quick-log buttons + today's list.
//

import SwiftUI

struct HomeView: View {
    @EnvironmentObject var store: EventStore

    private var schedule: Schedule { Schedule(settings: store.settings, events: store.events) }

    var body: some View {
        NavigationStack {
            List {
                Section {
                    NextDoseCard(schedule: schedule)
                        .listRowInsets(EdgeInsets())
                        .listRowBackground(Color.clear)
                }

                Section("Log") {
                    NavigationLink {
                        DoseLogView()
                    } label: { Label("Dose taken", systemImage: "pills.fill") }

                    NavigationLink {
                        SideEffectView()
                    } label: { Label("Side effect", systemImage: "exclamationmark.triangle.fill") }

                    NavigationLink {
                        MealView()
                    } label: { Label("Food", systemImage: "fork.knife") }

                    NavigationLink {
                        NoteView()
                    } label: { Label("Note", systemImage: "square.and.pencil") }
                }

                let today = store.events(on: Date())
                if !today.isEmpty {
                    Section("Today") {
                        ForEach(today) { e in
                            EventRow(event: e)
                        }
                        .onDelete { idx in
                            idx.map { today[$0] }.forEach(store.delete)
                        }
                    }
                }
            }
            .navigationTitle("Trial")
        }
    }
}

struct NextDoseCard: View {
    let schedule: Schedule

    var body: some View {
        VStack(spacing: 4) {
            switch schedule.status() {
            case .upcoming(let t):
                Text("Next dose").font(.caption2).foregroundStyle(.secondary)
                Text(t, style: .time).font(.title3.bold())
                Text(t, style: .relative).font(.caption2).foregroundStyle(.secondary)
                if let cut = schedule.fastingCutoff() {
                    Label("Stop eating by \(cut.formatted(date: .omitted, time: .shortened))",
                          systemImage: "fork.knife")
                        .font(.caption2).foregroundStyle(.orange)
                }
            case .dueNow(let until):
                Text("Dose due now").font(.caption2).foregroundStyle(.green)
                Text(until, style: .timer).font(.title3.bold()).foregroundStyle(.green)
                Text("left in flex window").font(.caption2).foregroundStyle(.secondary)
            case .overdue(let by):
                Text("Overdue").font(.caption2).foregroundStyle(.orange)
                Text(Self.duration(by)).font(.title3.bold()).foregroundStyle(.orange)
                Text("past flex window").font(.caption2).foregroundStyle(.secondary)
            case .none:
                Text("No dose scheduled").font(.caption)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 6)
    }

    private static func duration(_ s: TimeInterval) -> String {
        let m = Int(s / 60); return m >= 60 ? "\(m/60)h \(m%60)m" : "\(m)m"
    }
}

struct EventRow: View {
    let event: TrialEvent

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 1) {
                Text(title).font(.footnote.weight(.semibold))
                if let sub = subtitle { Text(sub).font(.caption2).foregroundStyle(.secondary) }
            }
            Spacer()
            Text(event.ts, style: .time).font(.caption2).foregroundStyle(.secondary)
        }
    }

    private var title: String {
        switch event.type {
        case .dose: return "\(event.mg ?? 0)mg dose"
        case .sideEffect: return "\(event.kind ?? "Effect") · \(event.intensity ?? 0)/10"
        case .note: return event.tags?.joined(separator: ", ") ?? "Note"
        case .meal: return event.food ?? "Food"
        }
    }
    private var subtitle: String? {
        switch event.type {
        case .meal: return event.amount
        case .note: return event.text
        default: return nil
        }
    }
}
