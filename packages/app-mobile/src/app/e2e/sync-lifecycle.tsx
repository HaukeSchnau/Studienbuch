import * as Network from "expo-network";
import { useEffect, useRef, useState } from "react";
import { AppState, type AppStateStatus, Pressable, StyleSheet, View } from "react-native";
import { Text } from "~/components/text";
import { isE2eModeEnabled } from "~/utils/e2e";
import { getStorage, setStorage, useStorage } from "~/utils/storage";
import {
  applySensitiveGradeReplay,
  createSensitiveGradeReplayState,
  createSyncLifecycleRefreshController,
  recordSensitiveGradeEvent,
  resolveNetworkOnline,
  SENSITIVE_GRADE_KINDS,
  type SensitiveGradeReplayState,
  sumSensitiveGradeCounts,
} from "~/utils/sync-lifecycle";

type CounterStorageKey =
  | "e2e.lifecycle.applied"
  | "e2e.lifecycle.launches"
  | "e2e.lifecycle.networkRefreshes"
  | "e2e.lifecycle.queued"
  | "e2e.lifecycle.replayCount"
  | "e2e.lifecycle.resumeRefreshes";

const COUNTER_KEYS: CounterStorageKey[] = [
  "e2e.lifecycle.queued",
  "e2e.lifecycle.applied",
  "e2e.lifecycle.replayCount",
  "e2e.lifecycle.resumeRefreshes",
  "e2e.lifecycle.networkRefreshes",
  "e2e.lifecycle.launches",
];

const readCounter = (key: CounterStorageKey): number => getStorage(key) ?? 0;

const setCounter = async (key: CounterStorageKey, value: number): Promise<void> => {
  await setStorage(key, value);
};

const incrementCounter = async (key: CounterStorageKey): Promise<void> => {
  await setCounter(key, readCounter(key) + 1);
};

const readSensitiveReplayState = (): SensitiveGradeReplayState =>
  getStorage("e2e.lifecycle.sensitive") ?? createSensitiveGradeReplayState();

const setSensitiveReplayState = async (state: SensitiveGradeReplayState): Promise<void> => {
  await setStorage("e2e.lifecycle.sensitive", state);
};

const applyQueuedReplayState = async (): Promise<void> => {
  const currentQueued = readCounter("e2e.lifecycle.queued");
  const currentApplied = readCounter("e2e.lifecycle.applied");
  if (currentQueued > currentApplied) {
    await setCounter("e2e.lifecycle.applied", currentQueued);
    await incrementCounter("e2e.lifecycle.replayCount");
  }

  const nextSensitiveReplayState = applySensitiveGradeReplay(readSensitiveReplayState());
  await setSensitiveReplayState(nextSensitiveReplayState);
};

const Metric = ({ testID, value }: { testID: string; value: string }) => (
  <Text testID={testID} style={styles.metric}>
    {value}
  </Text>
);

const ActionButton = ({ testID, label, onPress }: { testID: string; label: string; onPress: () => void }) => (
  <Pressable onPress={onPress} style={styles.button} testID={testID}>
    <Text style={styles.buttonLabel} weight="bold">
      {label}
    </Text>
  </Pressable>
);

export default function SyncLifecycleE2EScreen() {
  const e2eEnabled = isE2eModeEnabled();
  const [appState, setAppState] = useState<AppStateStatus>(AppState.currentState);
  const [networkOnline, setNetworkOnline] = useState<boolean>(true);

  const [queued] = useStorage("e2e.lifecycle.queued");
  const [applied] = useStorage("e2e.lifecycle.applied");
  const [replayCount] = useStorage("e2e.lifecycle.replayCount");
  const [resumeRefreshes] = useStorage("e2e.lifecycle.resumeRefreshes");
  const [networkRefreshes] = useStorage("e2e.lifecycle.networkRefreshes");
  const [sensitiveReplay] = useStorage("e2e.lifecycle.sensitive");

  const effectiveSensitiveReplay = sensitiveReplay ?? createSensitiveGradeReplayState();

  const controllerRef = useRef(
    createSyncLifecycleRefreshController({
      appState: AppState.currentState,
      online: true,
    }),
  );

  useEffect(() => {
    if (!e2eEnabled) {
      return;
    }

    void (async () => {
      await incrementCounter("e2e.lifecycle.launches");
      await applyQueuedReplayState();

      const state = await Network.getNetworkStateAsync();
      const online = resolveNetworkOnline(state);
      controllerRef.current.setNetworkOnline(online);
      setNetworkOnline(online);
    })();
  }, [e2eEnabled]);

  useEffect(() => {
    if (!e2eEnabled) {
      return;
    }

    const appStateSubscription = AppState.addEventListener("change", (nextState) => {
      if (controllerRef.current.onAppStateChange(nextState)) {
        void incrementCounter("e2e.lifecycle.resumeRefreshes");
      }

      setAppState(nextState);
    });

    const networkSubscription = Network.addNetworkStateListener((state) => {
      const online = resolveNetworkOnline(state);
      if (controllerRef.current.onNetworkChange(online)) {
        void incrementCounter("e2e.lifecycle.networkRefreshes");
        void applyQueuedReplayState();
      }

      setNetworkOnline(online);
    });

    return () => {
      appStateSubscription.remove();
      networkSubscription.remove();
    };
  }, [e2eEnabled]);

  const reset = () => {
    void Promise.all([
      ...COUNTER_KEYS.map((key) => setCounter(key, 0)),
      setSensitiveReplayState(createSensitiveGradeReplayState()),
    ]);
  };

  const queueReplay = () => {
    void incrementCounter("e2e.lifecycle.queued");
  };

  const simulateOffline = () => {
    controllerRef.current.setNetworkOnline(false);
    setNetworkOnline(false);
  };

  const simulateOnline = () => {
    if (controllerRef.current.onNetworkChange(true)) {
      void incrementCounter("e2e.lifecycle.networkRefreshes");
      void applyQueuedReplayState();
    }

    setNetworkOnline(true);
  };

  const queueSensitiveAuthorizedMatrix = () => {
    let state = readSensitiveReplayState();
    for (const kind of SENSITIVE_GRADE_KINDS) {
      state = recordSensitiveGradeEvent(state, {
        kind,
        authorized: true,
      });
    }

    void setSensitiveReplayState(state);
  };

  const rejectSensitiveUnauthorizedMatrix = () => {
    let state = readSensitiveReplayState();
    for (const kind of SENSITIVE_GRADE_KINDS) {
      state = recordSensitiveGradeEvent(state, {
        kind,
        authorized: false,
      });
    }

    void setSensitiveReplayState(state);
  };

  if (!e2eEnabled) {
    return (
      <View style={styles.container}>
        <Text testID="e2e-mode" style={styles.title} weight="bold">
          mode:disabled
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title} testID="e2e-title" weight="bold">
        Sync Lifecycle E2E
      </Text>
      <Metric testID="e2e-ready" value="ready" />
      <Metric testID="e2e-mode" value="mode:enabled" />
      <Metric testID="e2e-app-state" value={`app-state:${appState}`} />
      <Metric testID="e2e-network-online" value={`network-online:${networkOnline ? "true" : "false"}`} />
      <Metric testID="e2e-queued" value={`queued:${queued ?? 0}`} />
      <Metric testID="e2e-applied" value={`applied:${applied ?? 0}`} />
      <Metric testID="e2e-replay-count" value={`replay-count:${replayCount ?? 0}`} />
      <Metric testID="e2e-resume-refreshes" value={`resume-refreshes:${resumeRefreshes ?? 0}`} />
      <Metric testID="e2e-network-refreshes" value={`network-refreshes:${networkRefreshes ?? 0}`} />

      <View style={styles.buttons}>
        <ActionButton testID="e2e-reset" label="Reset State" onPress={reset} />
        <ActionButton testID="e2e-queue-replay" label="Queue Replay Event" onPress={queueReplay} />
        <ActionButton testID="e2e-simulate-offline" label="Simulate Offline" onPress={simulateOffline} />
        <ActionButton testID="e2e-simulate-online" label="Simulate Online" onPress={simulateOnline} />
        <ActionButton
          testID="e2e-queue-sensitive-auth-matrix"
          label="Queue Sensitive Authorized"
          onPress={queueSensitiveAuthorizedMatrix}
        />
        <ActionButton
          testID="e2e-reject-sensitive-auth-matrix"
          label="Reject Sensitive Unauthorized"
          onPress={rejectSensitiveUnauthorizedMatrix}
        />
      </View>

      <Metric
        testID="e2e-sensitive-queued"
        value={`sensitive-queued:${sumSensitiveGradeCounts(effectiveSensitiveReplay.queued)}`}
      />
      <Metric
        testID="e2e-sensitive-applied"
        value={`sensitive-applied:${sumSensitiveGradeCounts(effectiveSensitiveReplay.applied)}`}
      />
      <Metric
        testID="e2e-sensitive-rejected"
        value={`sensitive-rejected:${sumSensitiveGradeCounts(effectiveSensitiveReplay.rejected)}`}
      />
      <Metric
        testID="e2e-sensitive-replay-count"
        value={`sensitive-replay-count:${effectiveSensitiveReplay.replayCount}`}
      />
      <Metric
        testID="e2e-sensitive-matrix"
        value={`sensitive-matrix:tq${effectiveSensitiveReplay.queued.teacherApproved}-ta${effectiveSensitiveReplay.applied.teacherApproved}-tr${effectiveSensitiveReplay.rejected.teacherApproved}|pq${effectiveSensitiveReplay.queued.parentApproved}-pa${effectiveSensitiveReplay.applied.parentApproved}-pr${effectiveSensitiveReplay.rejected.parentApproved}|lq${effectiveSensitiveReplay.queued.latestRestored}-la${effectiveSensitiveReplay.applied.latestRestored}-lr${effectiveSensitiveReplay.rejected.latestRestored}`}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#FFFFFF",
    flex: 1,
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 28,
  },
  title: {
    color: "#1D1D1F",
    fontSize: 24,
  },
  metric: {
    color: "#1D1D1F",
    fontSize: 16,
  },
  buttons: {
    flexDirection: "row",
    gap: 12,
    marginTop: 20,
    flexWrap: "wrap",
  },
  button: {
    backgroundColor: "#6DB769",
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  buttonLabel: {
    color: "#FFFFFF",
    fontSize: 14,
  },
});
