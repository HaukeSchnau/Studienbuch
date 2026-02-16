import type { NetworkState } from "expo-network";
import type { AppStateStatus } from "react-native";

const ACTIVE_APP_STATE: AppStateStatus = "active";

export const shouldRefreshOnAppStateChange = (previous: AppStateStatus, next: AppStateStatus): boolean =>
  previous !== ACTIVE_APP_STATE && next === ACTIVE_APP_STATE;

export const resolveNetworkOnline = (state: Pick<NetworkState, "isConnected" | "isInternetReachable">): boolean => {
  if (typeof state.isInternetReachable === "boolean") {
    return state.isInternetReachable;
  }

  if (typeof state.isConnected === "boolean") {
    return state.isConnected;
  }

  // Unknown network state should not aggressively force reconnect churn.
  return true;
};

export const shouldRefreshOnNetworkChange = (previousOnline: boolean, nextOnline: boolean): boolean =>
  !previousOnline && nextOnline;

export const createSyncLifecycleRefreshController = (initial: { appState: AppStateStatus; online: boolean }) => {
  let appState = initial.appState;
  let online = initial.online;

  return {
    onAppStateChange(next: AppStateStatus): boolean {
      const shouldRefresh = shouldRefreshOnAppStateChange(appState, next);
      appState = next;
      return shouldRefresh;
    },
    onNetworkChange(nextOnline: boolean): boolean {
      const shouldRefresh = shouldRefreshOnNetworkChange(online, nextOnline);
      online = nextOnline;
      return shouldRefresh;
    },
    setNetworkOnline(nextOnline: boolean): void {
      online = nextOnline;
    },
  };
};
