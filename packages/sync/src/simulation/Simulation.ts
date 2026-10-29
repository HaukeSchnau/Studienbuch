/**
 * The seeded simulation: steps on a fresh world, invariants after each, then rest and its own
 * invariants. A workload behaves the same on every run, but its frames still differ in the devices'
 * span ids (`Math.random`) and the database's system identifier in the restore epoch.
 */
import * as Cause from "effect/Cause";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
import * as Option from "effect/Option";
import * as Predicate from "effect/Predicate";
import * as Random from "effect/Random";
import * as Schema from "effect/Schema";
import type * as SqlClient from "effect/sql/SqlClient";
import * as SubscriptionRef from "effect/SubscriptionRef";
import * as TestClock from "effect/testing/TestClock";
import { SyncClient } from "../client/SyncClient.ts";
import { Faults } from "../lab/Faults.ts";
import type { Listener } from "../server/Listener.ts";
import { SyncWriter } from "../server/SyncWriter.ts";
import { Invariants } from "./Invariants.ts";
import { Leaks } from "./Leaks.ts";
import { Planner } from "./Planner.ts";
import { World } from "./World.ts";

export * as Simulation from "./Simulation.ts";

/**
 * The engine sends no `Seal` yet (M1-WP-7's next PR), so a note would wait in the outbox for good
 * and hold back every later command. Note steps do nothing until it does.
 */
export const sealing = false;

const Device = Schema.Literals(World.deviceIds);

const Course = Schema.Literals([...World.offered, World.unknownCourse]);

/** Which of the device's notes, by position in id order, wrapping around. */
const Pick = Schema.Int.check(Schema.isBetween({ minimum: 0, maximum: 7 }));

const Turns = Schema.Int.check(Schema.isBetween({ minimum: 0, maximum: 60 }));

export const Add = Schema.TaggedStruct("Add", { device: Device, course: Course });

/** A note step on a device without notes does nothing. */
export const Rename = Schema.TaggedStruct("Rename", { device: Device, pick: Pick });

export const Toggle = Schema.TaggedStruct("Toggle", {
  device: Device,
  pick: Pick,
  done: Schema.Boolean,
});

export const Remove = Schema.TaggedStruct("Remove", { device: Device, pick: Pick });

export const Choose = Schema.TaggedStruct("Choose", {
  device: Device,
  courses: Schema.Array(Course).check(Schema.isMaxLength(3)),
});

/** One round of push and pull, as the engine runs after a connect or a poke. */
export const Sync = Schema.TaggedStruct("Sync", { device: Device });

/**
 * The engine crashes after `after` scheduler turns, wherever its supervisor is. With a turn before
 * every SQL statement, that can be inside any of its transactions.
 */
export const CrashDuringSync = Schema.TaggedStruct("CrashDuringSync", {
  device: Device,
  after: Turns,
});

/** The engine stops between two steps. */
export const Crash = Schema.TaggedStruct("Crash", { device: Device });

/** The engine stops while it writes a command, after `after` scheduler turns. */
export const CrashDuringChoose = Schema.TaggedStruct("CrashDuringChoose", {
  device: Device,
  courses: Schema.Array(Course).check(Schema.isMaxLength(3)),
  after: Turns,
});

export const Offline = Schema.TaggedStruct("Offline", { device: Device, offline: Schema.Boolean });

const oneShots = ["dropNextResponse", "duplicateNextPush", "reorderNext"] as const;

export const Fault = Schema.TaggedStruct("Fault", {
  device: Device,
  fault: Schema.Literals(oneShots),
});

export const Latency = Schema.TaggedStruct("Latency", {
  device: Device,
  millis: Schema.Int.check(Schema.isBetween({ minimum: 0, maximum: 2_000 })),
});

/** The network drops every connection of the device, which the server sees as 1006. */
export const Sever = Schema.TaggedStruct("Sever", { device: Device });

/** The device's next `choice.set` names a course the school doesn't offer, past its own check. */
export const ForgeChoice = Schema.TaggedStruct("ForgeChoice", { device: Device });

/**
 * The device's next `choice.set` becomes a command the server can't read, carrying a forged
 * marker: one whose mutator doesn't exist, or whose arguments don't decode. The server must refuse
 * it and store and log nothing of it.
 */
export const ForgeUnreadable = Schema.TaggedStruct("ForgeUnreadable", {
  device: Device,
  unknownMutator: Schema.Boolean,
});

/** The server stops or starts offering a course, as an import would. */
export const Offer = Schema.TaggedStruct("Offer", {
  course: Schema.Literals(World.offered),
  offered: Schema.Boolean,
});

/** The user dismisses the device's oldest refusal. */
export const Dismiss = Schema.TaggedStruct("Dismiss", { device: Device });

export const Wait = Schema.TaggedStruct("Wait", {
  millis: Schema.Int.check(Schema.isBetween({ minimum: 0, maximum: 300_000 })),
});

const noteSteps = [Add, Rename, Toggle, Remove] as const;

const readableSteps = [
  Choose,
  Sync,
  CrashDuringSync,
  Crash,
  CrashDuringChoose,
  Offline,
  Fault,
  Latency,
  Sever,
  ForgeChoice,
  ForgeUnreadable,
  Offer,
  Dismiss,
  Wait,
] as const;

/** One thing that happens. */
export const Step = Schema.Union([...noteSteps, ...readableSteps]);

export type Step = typeof Step.Type;

const workload = (steps: Schema.Codec<Step, unknown>) =>
  Schema.Struct({
    /** Seeds `Random` for everything in the run: ids, client ids, the restore epoch's id. */
    seed: Schema.Int,
    steps: Schema.Array(steps).check(Schema.isMinLength(15), Schema.isMaxLength(40)),
  });

export const Workload = workload(Step);

export type Workload = typeof Workload.Type;

/**
 * What random workloads draw from. Until the engine seals, a note step would only fill a workload
 * with steps that do nothing, so they stay out.
 */
export const Generated = workload(sealing ? Step : Schema.Union(readableSteps));

export interface Violation extends Invariants.Violation {
  /** The step after which it showed, counting from 0, or `settled` at quiescence. */
  readonly step: number | "settled";
}

/** The faults that fire once, and forges, which the result counts. */
export const Counted = Schema.Literals([...oneShots, "forge"]);

export type Counted = typeof Counted.Type;

const isCounted = Schema.is(Counted);

/** Counts of faults armed and fired, all zero. */
export const noFaults = (): Record<Counted, { armed: number; fired: number }> => ({
  dropNextResponse: { armed: 0, fired: 0 },
  duplicateNextPush: { armed: 0, fired: 0 },
  reorderNext: { armed: 0, fired: 0 },
  forge: { armed: 0, fired: 0 },
});

export interface Result {
  /**
   * One line per step with what it did, and one per fault that fired. Every run of the workload
   * behaves the same, so its trace is the same.
   */
  readonly trace: ReadonlyArray<string>;
  readonly violations: ReadonlyArray<Violation>;
  /** How many times a step armed each kind of fault while none was armed, and how often it fired. */
  readonly faults: Readonly<Record<Counted, { readonly armed: number; readonly fired: number }>>;
}

const encodeStep = Schema.encodeEffect(Schema.fromJsonString(Step));

/** How far the clock moves at a time while a step lets the engines work. */
const tick = Duration.millis(50);

/** How long a `Sync` step lets a device work before the next step. */
const syncFor = Duration.seconds(30);

/**
 * How long settling lets every device work: more than the supervisor's 5-minute pull, so each
 * device pulls after the last change even without a poke, and more than its longest backoff.
 */
const settleFor = Duration.minutes(6);

/** How much longer a device may stay busy after that before it breaks liveness. */
const patience = Duration.minutes(5);

/**
 * Lets simulated time pass until `done` holds or `limit` passed, and says whether it held. The
 * engines' supervisors, timers and latency all run on this clock.
 */
const until = Effect.fn("Simulation.until")(function* (
  done: Effect.Effect<boolean>,
  limit: Duration.Duration,
  step: Duration.Duration = tick,
) {
  for (let waited = 0; waited < Duration.toMillis(limit); waited += Duration.toMillis(step)) {
    if (yield* done) return true;
    yield* TestClock.adjust(step);
  }

  return yield* done;
});

/** A fresh note id: random, as encrypted rows' ids are, so the server can't date them. */
const noteId = Effect.map(World.uuid, (id) => `note-${id}`);

/** The id of the device's `pick`th note in id order, if it has any. */
const picked = (device: World.Device, pick: number) =>
  device.sql(device.notes).pipe(
    Effect.map((ids) => (ids.length === 0 ? undefined : ids[pick % ids.length])),
    Effect.orDie,
  );

/** What a step's engine call ended with, in a few words for the trace. */
const describe = <A, E extends { readonly _tag: string }>(
  exit: Exit.Exit<A, E>,
  success: (value: A) => string,
) =>
  Exit.match(exit, {
    onSuccess: success,
    onFailure: (cause) => {
      if (Cause.hasInterruptsOnly(cause)) return "interrupted";
      const error = Cause.findErrorOption(cause);

      return Option.isSome(error) ? `failed ${error.value._tag}` : "died";
    },
  });

const queued = (mutation: SyncClient.Mutation) => `queued #${mutation.mutationId}`;

export const run = (workload: Workload) =>
  Effect.gen(function* () {
    const world = yield* World.make;
    const trace: Array<string> = [];
    const violations: Array<Violation> = [];
    const hung: Array<Invariants.Violation> = [];

    const dismissed = new Map<World.DeviceId, Set<number>>(
      World.deviceIds.map((id) => [id, new Set<number>()]),
    );

    let markers = 0;
    let framesChecked = 0;
    let linesChecked = 0;
    const marker = () => Leaks.marker(markers++);

    const faults = noFaults();

    /** Arms a fault on `on` and counts it, unless one of its kind was armed already. */
    const arm = Effect.fn("Simulation.arm")(function* (
      on: World.Device,
      kind: Counted,
      arming: Effect.Effect<void>,
    ) {
      const before = yield* SubscriptionRef.get(on.faults.settings);
      const armed = kind === "forge" ? Option.isSome(before.forge) : before[kind];

      yield* arming;

      if (armed) return "armed already";
      faults[kind].armed += 1;

      return "armed";
    });

    /** Counts and traces the faults that fired since the last call. */
    const traceFired = Effect.gen(function* () {
      for (const each of world.devices.values()) {
        for (const event of yield* each.fired) {
          if (!isCounted(event.fault)) continue;
          faults[event.fault].fired += 1;
          trace.push(`  ${each.id} fired ${event.fault}: ${event.detail}`);
        }
      }
    });

    const device = (id: World.DeviceId) => {
      const found = world.devices.get(id);

      return found === undefined ? Effect.die(`No device ${id}`) : Effect.succeed(found);
    };

    const mutate = <E extends { readonly _tag: string }>(
      on: World.Device,
      run: (sync: SyncClient.Interface) => Effect.Effect<SyncClient.Mutation, E>,
    ) =>
      Effect.map(on.engine(Effect.flatMap(SyncClient.Service, run)), (exit) =>
        describe(exit, queued),
      );

    const choose = (on: World.Device, courses: ReadonlyArray<string>) =>
      mutate(on, (sync) =>
        sync.mutate(Planner.choose, { notebook: on.notebook, school: World.school, courses }),
      );

    /** Lets `on` work until it is idle, for at most `limit`. */
    const syncing = (on: World.Device, limit: Duration.Duration = syncFor) =>
      Effect.map(until(on.idle, limit), (idle) => (idle ? "idle" : "busy"));

    const apply = Effect.fnUntraced(function* (step: Step) {
      switch (step._tag) {
        case "Add":
        case "Rename":
        case "Toggle":
        case "Remove": {
          if (!sealing) return "skipped until the engine seals";
          const on = yield* device(step.device);
          const notebook = on.notebook;

          if (step._tag === "Add") {
            const id = yield* noteId;

            return yield* mutate(on, (sync) =>
              sync.mutate(Planner.add, { notebook, id, course: step.course, title: marker() }),
            );
          }

          const id = yield* picked(on, step.pick);

          if (id === undefined) return "no note";

          return yield* mutate(on, (sync) =>
            step._tag === "Rename"
              ? sync.mutate(Planner.rename, { notebook, id, title: marker() })
              : step._tag === "Toggle"
                ? sync.mutate(Planner.toggle, { notebook, id, done: step.done })
                : sync.mutate(Planner.remove, { notebook, id }),
          );
        }

        case "Choose":
          return yield* choose(yield* device(step.device), step.courses);

        case "Sync":
          return yield* syncing(yield* device(step.device));

        case "CrashDuringSync": {
          const on = yield* device(step.device);

          for (let turn = 0; turn < step.after; turn++) yield* Effect.yieldNow;
          yield* on.crash;

          return "crashed";
        }

        case "CrashDuringChoose": {
          const on = yield* device(step.device);
          const work = yield* Effect.forkChild(choose(on, step.courses));

          for (let turn = 0; turn < step.after; turn++) yield* Effect.yieldNow;
          yield* on.crash;

          return `crashed; it ${yield* Fiber.join(work)}`;
        }

        case "Crash": {
          yield* (yield* device(step.device)).crash;

          return "restarted";
        }

        case "Offline": {
          yield* (yield* device(step.device)).faults.setOffline(step.offline);

          return step.offline ? "offline" : "online";
        }

        case "Fault": {
          const on = yield* device(step.device);

          return yield* arm(on, step.fault, on.faults.arm(step.fault));
        }

        case "Latency": {
          yield* (yield* device(step.device)).faults.setLatency(Duration.millis(step.millis));

          return "set";
        }

        case "Sever": {
          yield* world.network.sever(step.device);

          return "severed";
        }

        case "ForgeChoice": {
          const on = yield* device(step.device);

          // Arguments the server must refuse: a course the school never offers.
          const forge = Faults.Forge.RewriteArgs({
            mutator: Planner.choose.name,
            args: { notebook: on.notebook, school: World.school, courses: [World.unknownCourse] },
          });

          return yield* arm(on, "forge", on.faults.forge(forge));
        }

        case "ForgeUnreadable": {
          const on = yield* device(step.device);
          const leaked = Leaks.forgedMarker(markers++);

          const forge = step.unknownMutator
            ? Faults.Forge.RewriteArgs({
                mutator: Planner.choose.name,
                name: "note.leak",
                args: { title: leaked },
              })
            : Faults.Forge.RewriteArgs({
                mutator: Planner.choose.name,
                args: { notebook: on.notebook, school: World.school, courses: leaked },
              });

          return yield* arm(on, "forge", on.faults.forge(forge));
        }

        case "Offer": {
          yield* world
            .server(
              Effect.flatMap(SyncWriter.Service, (writer) =>
                writer.reconcile(
                  World.school,
                  Planner.Offer,
                  step.offered ? [{ id: step.course, row: { name: step.course } }] : [],
                  { covers: (entry) => entry.id === step.course },
                ),
              ),
            )
            .pipe(Effect.orDie);

          return step.offered ? "offered" : "withdrawn";
        }

        case "Dismiss": {
          const on = yield* device(step.device);

          const exit = yield* on.engine(
            Effect.gen(function* () {
              const sync = yield* SyncClient.Service;
              const [oldest] = yield* on.sql(SyncClient.refusals.run());

              if (oldest === undefined) return "nothing to dismiss";
              yield* sync.dismiss(oldest);
              dismissed.get(on.id)?.add(oldest.mutationId);

              return `dismissed #${oldest.mutationId}`;
            }),
          );

          return describe(exit, (done) => done);
        }

        case "Wait": {
          yield* TestClock.adjust(step.millis);

          return "waited";
        }
      }
    });

    /** What must hold after every step. */
    const check = Effect.gen(function* () {
      const found: Array<Invariants.Violation> = [];

      for (const each of world.devices.values()) {
        const place = `device ${each.id}`;

        found.push(...(yield* each.sql(Invariants.replay(place, Planner.schema, each.account))));
        found.push(...(yield* each.sql(Invariants.gapless(place))));
      }

      const frames = world.frames();

      for (const frame of frames.slice(framesChecked)) {
        found.push(
          ...Invariants.plaintextIn(
            `frame ${frame.direction} device ${frame.device}`,
            Predicate.isString(frame.data) ? frame.data : new TextDecoder().decode(frame.data),
            Leaks.forms,
          ),
        );
      }

      framesChecked = frames.length;
      const lines = world.serverLines();

      for (const line of lines.slice(linesChecked))
        found.push(...Invariants.plaintextIn("server log", line));

      linesChecked = lines.length;
      found.push(...hung.splice(0));

      return found;
    });

    /**
     * Brings every device back online at full speed and lets them work, so the world can come to
     * rest. A one-shot fault or a forge still armed fires on the device's next answer or push.
     */
    const settle = Effect.gen(function* () {
      for (const each of world.devices.values()) {
        yield* each.faults.setOffline(false);
        yield* each.faults.setLatency(Duration.zero);
      }

      const devices = [...world.devices.values()];

      const allIdle = Effect.map(
        Effect.forEach(devices, (each) => each.idle),
        (idle) => idle.every(Boolean),
      );

      yield* until(Effect.succeed(false), settleFor, Duration.seconds(1));

      if (!(yield* until(allIdle, patience))) {
        for (const each of devices) {
          if (!(yield* each.idle)) {
            hung.push({ invariant: "liveness", place: `device ${each.id}`, detail: "never idle" });
          }
        }
      }

      yield* traceFired;

      for (const each of devices)
        trace.push(`settled ${each.id} ${yield* syncing(each, Duration.zero)}`);
    });

    /** What must hold once the world is at rest. */
    const atRest = Effect.gen(function* () {
      const found: Array<Invariants.Violation> = [];

      for (const each of world.devices.values()) {
        const place = `device ${each.id}`;
        const state = yield* each.sql(Invariants.settledState);
        const log = yield* world.server(Invariants.serverLog(state.meta.clientId));

        found.push(
          ...Invariants.nothingLost(place, state, log, dismissed.get(each.id) ?? new Set()),
        );

        found.push(
          ...Invariants.converged(
            place,
            yield* each.sql(Invariants.deviceRows),
            yield* world.server(Invariants.serverRows(each.account)),
          ),
        );
      }

      found.push(...(yield* world.server(Invariants.plaintextInPostgres)));

      return found;
    });

    // A device's first sync is its first pull, which tells it the spaces it reads.
    for (const each of world.devices.values())
      trace.push(`start ${each.id} ${yield* syncing(each)}`);

    for (const [index, step] of workload.steps.entries()) {
      const done = yield* apply(step);
      trace.push(`${index} ${yield* Effect.orDie(encodeStep(step))} ${done}`);
      yield* traceFired;

      for (const violation of yield* check) violations.push({ ...violation, step: index });

      if (violations.length > 0) return { trace, violations, faults } satisfies Result;
    }

    yield* settle;

    for (const violation of [...(yield* check), ...(yield* atRest)]) {
      violations.push({ ...violation, step: "settled" });
    }

    return { trace, violations, faults } satisfies Result;
  }).pipe(
    Effect.scoped,
    Random.withSeed(workload.seed),
    Effect.provide(TestClock.layer()),
  ) satisfies Effect.Effect<Result, never, SqlClient.SqlClient | Listener.Service>;
