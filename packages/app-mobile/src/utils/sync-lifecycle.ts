import type { NetworkState } from "expo-network";
import type { AppStateStatus } from "react-native";

const ACTIVE_APP_STATE: AppStateStatus = "active";
export const SENSITIVE_GRADE_KINDS = ["teacherApproved", "parentApproved", "latestRestored"] as const;

export type SensitiveGradeKind = (typeof SENSITIVE_GRADE_KINDS)[number];

type SensitiveGradeCounts = Record<SensitiveGradeKind, number>;

export type SensitiveGradeReplayState = {
  queued: SensitiveGradeCounts;
  applied: SensitiveGradeCounts;
  rejected: SensitiveGradeCounts;
  replayCount: number;
};

const emptySensitiveGradeCounts = (): SensitiveGradeCounts => ({
  teacherApproved: 0,
  parentApproved: 0,
  latestRestored: 0,
});

export const createSensitiveGradeReplayState = (): SensitiveGradeReplayState => ({
  queued: emptySensitiveGradeCounts(),
  applied: emptySensitiveGradeCounts(),
  rejected: emptySensitiveGradeCounts(),
  replayCount: 0,
});

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

export const recordSensitiveGradeEvent = (
  state: SensitiveGradeReplayState,
  event: {
    kind: SensitiveGradeKind;
    authorized: boolean;
  },
): SensitiveGradeReplayState => {
  if (!event.authorized) {
    return {
      ...state,
      rejected: {
        ...state.rejected,
        [event.kind]: state.rejected[event.kind] + 1,
      },
    };
  }

  return {
    ...state,
    queued: {
      ...state.queued,
      [event.kind]: state.queued[event.kind] + 1,
    },
  };
};

export const applySensitiveGradeReplay = (state: SensitiveGradeReplayState): SensitiveGradeReplayState => {
  let replayApplied = false;
  const nextApplied: SensitiveGradeCounts = { ...state.applied };

  for (const kind of SENSITIVE_GRADE_KINDS) {
    const missing = state.queued[kind] - state.applied[kind];
    if (missing <= 0) {
      continue;
    }

    nextApplied[kind] += missing;
    replayApplied = true;
  }

  if (!replayApplied) {
    return state;
  }

  return {
    ...state,
    applied: nextApplied,
    replayCount: state.replayCount + 1,
  };
};

export const sumSensitiveGradeCounts = (counts: SensitiveGradeCounts): number =>
  counts.teacherApproved + counts.parentApproved + counts.latestRestored;

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
