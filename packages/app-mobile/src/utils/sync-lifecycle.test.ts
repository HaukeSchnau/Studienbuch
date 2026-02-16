import { describe, expect, it } from "vitest";
import {
  createSyncLifecycleRefreshController,
  resolveNetworkOnline,
  shouldRefreshOnAppStateChange,
  shouldRefreshOnNetworkChange,
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
