//
//  PhoneConnector.swift
//  Best-effort one-way sync of new events to the iPhone companion via
//  WatchConnectivity. transferUserInfo queues delivery even if the phone is
//  asleep / unreachable.
//

import Foundation
import WatchConnectivity

final class PhoneConnector: NSObject, WCSessionDelegate {
    static let shared = PhoneConnector()

    func activate() {
        guard WCSession.isSupported() else { return }
        WCSession.default.delegate = self
        WCSession.default.activate()
    }

    func send(event: TrialEvent) {
        guard WCSession.isSupported() else { return }
        let enc = JSONEncoder(); enc.dateEncodingStrategy = .iso8601
        guard let data = try? enc.encode(event) else { return }
        WCSession.default.transferUserInfo(["event": data])
    }

    // MARK: - Delegate (no-ops for Phase 1, watch is the source of truth)
    func session(_ session: WCSession, activationDidCompleteWith state: WCSessionActivationState,
                 error: Error?) {}
}
