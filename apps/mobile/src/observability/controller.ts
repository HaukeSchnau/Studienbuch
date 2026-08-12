import type { TelemetryOutbox } from "./outbox";

export interface TelemetryLifecycle {
  readonly isActive: () => boolean;
  readonly subscribe: (onActive: () => void) => () => void;
}

export interface TelemetryConnectivity {
  readonly isOnline: () => boolean;
  readonly subscribe: (onOnline: () => void) => () => void;
}

export interface TelemetryScheduler {
  readonly every: (milliseconds: number, task: () => void) => () => void;
}

export const startTelemetryController = (options: {
  readonly outbox: TelemetryOutbox;
  readonly lifecycle: TelemetryLifecycle;
  readonly connectivity: TelemetryConnectivity;
  readonly scheduler: TelemetryScheduler;
  readonly flushIntervalMs?: number;
}): (() => void) => {
  let running = false;
  const flush = () => {
    if (running || !options.lifecycle.isActive()) return;
    running = true;
    void options.outbox.flush(options.connectivity.isOnline()).finally(() => {
      running = false;
    });
  };
  const unsubscribeLifecycle = options.lifecycle.subscribe(flush);
  const unsubscribeConnectivity = options.connectivity.subscribe(flush);
  const cancelTimer = options.scheduler.every(options.flushIntervalMs ?? 30_000, flush);
  flush();
  return () => {
    unsubscribeLifecycle();
    unsubscribeConnectivity();
    cancelTimer();
  };
};
