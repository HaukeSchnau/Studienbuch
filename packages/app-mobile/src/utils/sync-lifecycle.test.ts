import { describe, expect, it } from "vitest";
import {
  applySensitiveGradeReplay,
  createSensitiveGradeReplayState,
  createSyncLifecycleRefreshController,
  recordSensitiveGradeEvent,
  resolveNetworkOnline,
  shouldRefreshOnAppStateChange,
  shouldRefreshOnNetworkChange,
  sumSensitiveGradeCounts,
} from "./sync-lifecycle";

describe("sync lifecycle transitions", () => {
  it("refreshes when app moves from background to active", () => {
    expect(shouldRefreshOnAppStateChange("background", "active")).toBe(true);
    expect(shouldRefreshOnAppStateChange("inactive", "active")).toBe(true);
    expect(shouldRefreshOnAppStateChange("active", "active")).toBe(false);
    expect(shouldRefreshOnAppStateChange("active", "background")).toBe(false);
  });

  it("refreshes only on offline-to-online network transitions", () => {
    expect(shouldRefreshOnNetworkChange(false, true)).toBe(true);
    expect(shouldRefreshOnNetworkChange(true, false)).toBe(false);
    expect(shouldRefreshOnNetworkChange(true, true)).toBe(false);
    expect(shouldRefreshOnNetworkChange(false, false)).toBe(false);
  });

  it("resolves online status from internet reachability first", () => {
    expect(resolveNetworkOnline({ isInternetReachable: true, isConnected: false })).toBe(true);
    expect(resolveNetworkOnline({ isInternetReachable: false, isConnected: true })).toBe(false);
    expect(resolveNetworkOnline({ isInternetReachable: undefined, isConnected: true })).toBe(true);
    expect(resolveNetworkOnline({ isInternetReachable: undefined, isConnected: false })).toBe(false);
    expect(resolveNetworkOnline({ isInternetReachable: undefined, isConnected: undefined })).toBe(true);
  });
});

describe("createSyncLifecycleRefreshController", () => {
  it("tracks app and network transitions without duplicate refresh signals", () => {
    const controller = createSyncLifecycleRefreshController({
      appState: "active",
      online: true,
    });

    expect(controller.onAppStateChange("inactive")).toBe(false);
    expect(controller.onAppStateChange("background")).toBe(false);
    expect(controller.onAppStateChange("active")).toBe(true);
    expect(controller.onAppStateChange("active")).toBe(false);

    expect(controller.onNetworkChange(false)).toBe(false);
    expect(controller.onNetworkChange(true)).toBe(true);
    expect(controller.onNetworkChange(true)).toBe(false);
  });
});

describe("sensitive grade lifecycle replay", () => {
  it("queues authorized events, rejects unauthorized events, and applies only authorized replay", () => {
    let state = createSensitiveGradeReplayState();

    state = recordSensitiveGradeEvent(state, {
      kind: "teacherApproved",
      authorized: true,
    });
    state = recordSensitiveGradeEvent(state, {
      kind: "parentApproved",
      authorized: true,
    });
    state = recordSensitiveGradeEvent(state, {
      kind: "latestRestored",
      authorized: true,
    });

    state = recordSensitiveGradeEvent(state, {
      kind: "teacherApproved",
      authorized: false,
    });
    state = recordSensitiveGradeEvent(state, {
      kind: "parentApproved",
      authorized: false,
    });
    state = recordSensitiveGradeEvent(state, {
      kind: "latestRestored",
      authorized: false,
    });

    expect(sumSensitiveGradeCounts(state.queued)).toBe(3);
    expect(sumSensitiveGradeCounts(state.applied)).toBe(0);
    expect(sumSensitiveGradeCounts(state.rejected)).toBe(3);
    expect(state.replayCount).toBe(0);

    state = applySensitiveGradeReplay(state);

    expect(sumSensitiveGradeCounts(state.queued)).toBe(3);
    expect(sumSensitiveGradeCounts(state.applied)).toBe(3);
    expect(sumSensitiveGradeCounts(state.rejected)).toBe(3);
    expect(state.replayCount).toBe(1);
    expect(state.applied.teacherApproved).toBe(1);
    expect(state.applied.parentApproved).toBe(1);
    expect(state.applied.latestRestored).toBe(1);
  });

  it("does not duplicate replay application when nothing new is queued", () => {
    let state = createSensitiveGradeReplayState();

    state = recordSensitiveGradeEvent(state, {
      kind: "teacherApproved",
      authorized: true,
    });

    const replayedOnce = applySensitiveGradeReplay(state);
    const replayedTwice = applySensitiveGradeReplay(replayedOnce);

    expect(replayedOnce.applied.teacherApproved).toBe(1);
    expect(replayedOnce.replayCount).toBe(1);
    expect(replayedTwice).toEqual(replayedOnce);
  });
});
