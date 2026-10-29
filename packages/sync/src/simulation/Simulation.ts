/**
 * The seeded simulation: steps on a fresh world, invariants after each, then rest and its own
 * invariants. On PGlite a workload sends the same frames and logs the same lines on every run. On
 * PostgreSQL 18 it does the same things, but concurrent answers may arrive in another order.
 */
import * as Arbitrary from "effect/Arbitrary";
import * as Cause from "effect/Cause";
import * as Duration from "effect/Duration";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
import * as Option from "effect/Option";
import * as Predicate from "effect/Predicate";
import * as Random from "effect/Random";
import * as Schema from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";
import * as SubscriptionRef from "effect/SubscriptionRef";
import * as TestClock from "effect/testing/TestClock";
import { Outbox } from "../client/Outbox.ts";
import { SyncClient } from "../client/SyncClient.ts";
import { Faults } from "../lab/Faults.ts";
import type { Listener } from "../server/Listener.ts";
import { Spaces } from "../server/Spaces.ts";
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

/** Which SQL statement from now a crash comes before, counting from 1. */
const Statement = (maximum: number) => Schema.Int.check(Schema.isBetween({ minimum: 1, maximum }));

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
 * The app comes to the front, which runs a round, time passes as in `Sync`, and the engine crashes
 * before its `statement`th SQL statement. That can be inside any of its transactions. Without that
 * many statements, it crashes once the time is up.
 */
export const CrashDuringSync = Schema.TaggedStruct("CrashDuringSync", {
  device: Device,
  statement: Statement(40),
});

/** The engine stops between two steps. */
export const Crash = Schema.TaggedStruct("Crash", { device: Device });

/** The engine crashes before its `statement`th SQL statement after it started to write a command. */
export const CrashDuringChoose = Schema.TaggedStruct("CrashDuringChoose", {
  device: Device,
  courses: Schema.Array(Course).check(Schema.isMaxLength(3)),
  statement: Statement(20),
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

/**
 * The school changes an offer while every device pulls: the import holds `sync_row` until a pull
 * waits for it, so its commit lands between that pull's first and last statement. PGlite has one
 * connection, which a pull would wait for instead, so there it is a plain `Offer`.
 */
export const OfferDuringPulls = Schema.TaggedStruct("OfferDuringPulls", {
  course: Schema.Literals(World.offered),
  offered: Schema.Boolean,
});

/** The user dismisses the device's oldest refusal. */
export const Dismiss = Schema.TaggedStruct("Dismiss", { device: Device });

/** The student leaves the school, losing its courses, or is admitted again. */
export const Admit = Schema.TaggedStruct("Admit", {
  account: Schema.Literals(World.accountIds),
  admitted: Schema.Boolean,
});

/** The device's database is copied, as a phone's nightly backup is. */
export const Backup = Schema.TaggedStruct("Backup", { device: Device });

/**
 * The device's last backup comes back in place of its database, as when a phone is restored. It
 * may then make commands under mutation ids the server already used. Every device has a backup
 * from right after its first sync.
 */
export const Restore = Schema.TaggedStruct("Restore", { device: Device });

/** Time passes. Waiting no time is the padding that shrinking puts in place of a step. */
export const Wait = Schema.TaggedStruct("Wait", {
  millis: Schema.Int.check(Schema.isBetween({ minimum: 0, maximum: 300_000 })),
});

/** The step that does nothing and that the trace leaves out. */
export const padding = Wait.make({ millis: 0 });

const isPadding = (step: Step) => step._tag === "Wait" && step.millis === 0;

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
  OfferDuringPulls,
  Dismiss,
  Admit,
  Backup,
  Restore,
  Wait,
] as const;

/** One thing that happens. */
export const Step = Schema.Union([...noteSteps, ...readableSteps]);

export type Step = typeof Step.Type;

export const Workload = Schema.Struct({
  /** Seeds `Random` for everything in the run: ids, client ids, the restore epoch's id. */
  seed: Schema.Int,
  steps: Schema.Array(Step).check(Schema.isMaxLength(40)),
});

export type Workload = typeof Workload.Type;

/**
 * What random workloads draw from: at least 15 steps, so each reaches its faults. Until the engine
 * seals, a note step would only fill a workload with steps that do nothing, so they stay out.
 */
const Generated = Schema.Struct({
  seed: Schema.Int,
  // `Choose` three times over: it is the one command, and most faults act on what commands send.
  steps: Schema.Array(
    Schema.Union([...(sealing ? noteSteps : []), Choose, Choose, ...readableSteps]),
  ).check(Schema.isMinLength(15), Schema.isMaxLength(40)),
});

/**
 * Smaller workloads that may fail the same way: the same length, with padding in place of the
 * steps of each half, then each quarter, down to each single step.
 */
const shrink = (workload: Workload): ReadonlyArray<Workload> => {
  const real = workload.steps.flatMap((step, index) => (isPadding(step) ? [] : [index]));
  const candidates: Array<Workload> = [];

  for (
    let size = Math.ceil(real.length / 2);
    size >= 1;
    size = size === 1 ? 0 : Math.ceil(size / 2)
  ) {
    for (let start = 0; start < real.length; start += size) {
      const padded = new Set(real.slice(start, start + size));

      candidates.push({
        ...workload,
        steps: workload.steps.map((step, index) => (padded.has(index) ? padding : step)),
      });
    }
  }

  return candidates;
};

/**
 * Random workloads. A failure shrinks by padding out steps rather than removing them, so the
 * minimum length holds, and the trace shows only the steps left.
 */
export const arbitrary = Arbitrary.schema(Generated, { shrink });

export interface Violation extends Invariants.Violation {
  /**
   * The step after which it showed, counting from 0. `settled` once the world came to rest, and
   * `resumed` once it came to rest again after every device ran one more round.
   */
  readonly step: number | "settled" | "resumed";
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
  /** Every frame either end received, by direction and device, the system identifier replaced. */
  readonly frames: ReadonlyArray<string>;
  /** Every line the server logged and every span it ended, the system identifier replaced. */
  readonly lines: ReadonlyArray<string>;
}

const encodeStep = Schema.encodeEffect(Schema.fromJsonString(Step));

/** How far the clock moves at a time while a step lets the engines work. */
const tick = Duration.millis(50);

/** How long a `Sync` step lets a device work before the next step. */
const syncFor = Duration.seconds(30);

/**
 * How long settling lets every device work: more than the supervisor's longest backoff, so a
 * device that lost its connection is back. Nothing pulls on a timer, so only pokes bring news.
 */
const settleFor = Duration.minutes(6);

/** How much longer a device may stay busy after that before it breaks liveness. */
const patience = Duration.minutes(5);

/** A fresh note id: random, as encrypted rows' ids are, so the server can't date them. */
const noteId = Effect.map(World.uuid, (id) => `note-${id}`);

/** The id of the device's `pick`th note in id order, if it has any. */
const picked = (device: World.Device, pick: number) =>
  device.sql(device.notes).pipe(
    Effect.map((ids) => (ids.length === 0 ? undefined : ids[pick % ids.length])),
    Effect.orDie,
  );

/** The school's offer of `course` as an import writes it, in the caller's transaction. */
const offer = (change: { readonly course: string; readonly offered: boolean }) =>
  Effect.flatMap(SyncWriter.Service, (writer) =>
    writer.reconcile(
      World.school,
      Planner.Offer,
      change.offered ? [{ id: change.course, row: { name: change.course } }] : [],
      { covers: (entry) => entry.id === change.course },
    ),
  );

/** Where the membership rule reads a notebook's chosen courses. */
const choice = { table: Planner.Choice.name, id: Planner.choiceId, kind: Planner.Course.name };

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

    /** The refusals each device's user dismissed, by client id and mutation id. */
    const dismissed = new Map<World.DeviceId, ReadonlySet<string>>(
      World.deviceIds.map((id) => [id, new Set<string>()]),
    );

    /** What each device's user had dismissed when its last backup was made. */
    const dismissedAtBackup = new Map<World.DeviceId, ReadonlySet<string>>();

    /** Moves the simulated clock once the server answered what it was asked. */
    const advance = (by: Duration.Duration) => Effect.andThen(world.quiet, TestClock.adjust(by));

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
        yield* advance(step);
      }

      return yield* done;
    });

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

    /** Traces the connections that closed and the faults that fired since the last call. */
    const traceEvents = Effect.gen(function* () {
      for (const close of yield* world.closed) trace.push(`  closed ${close}`);

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
          const stopped = yield* on.stopBefore(step.statement);
          yield* on.resume;
          const reached = yield* until(Deferred.isDone(stopped), syncFor);
          const inRound = yield* on.syncing;
          const ran = yield* on.statements;
          yield* on.crash;

          if (!reached) return `crashed after ${ran} statements, none of them the stop`;
          const at = yield* Deferred.await(stopped);

          return `crashed before statement ${at.statement}${at.inTransaction ? " in a transaction" : ""}${inRound ? " of a round" : ", between rounds"}`;
        }

        case "CrashDuringChoose": {
          const on = yield* device(step.device);

          const last = on
            .sql(Effect.map(Outbox.meta, (meta) => meta.lastMutationId))
            .pipe(Effect.orDie);

          const before = yield* last;
          const stopped = yield* on.stopBefore(step.statement);
          const work = yield* Effect.forkChild(choose(on, step.courses));

          yield* Effect.raceFirst(Deferred.await(stopped), Fiber.await(work));
          const at = yield* Deferred.poll(stopped);
          yield* on.crash;
          const outcome = yield* Fiber.join(work);
          const after = yield* last;

          if (after > before) return `committed #${after}, then crashed`;

          return Option.match(at, {
            onNone: () => `${outcome}, then crashed`,
            onSome: () =>
              `crashed before statement ${step.statement} of the write, which queued nothing`,
          });
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
          yield* world.server(offer(step)).pipe(Effect.orDie);

          return step.offered ? "offered" : "withdrawn";
        }

        case "OfferDuringPulls": {
          const done = step.offered ? "offered" : "withdrawn";

          if (!world.concurrent) {
            yield* world.server(offer(step)).pipe(Effect.orDie);

            return `${done} with no pull alongside, on one connection`;
          }

          const holding = yield* Deferred.make<void>();
          const release = yield* Deferred.make<void>();

          const importing = yield* Effect.forkChild(
            world
              .server(
                Effect.flatMap(SqlClient.SqlClient, (sql) =>
                  sql.withTransaction(
                    Effect.gen(function* () {
                      yield* sql`lock table sync_row in access exclusive mode`;
                      yield* offer(step);
                      yield* Deferred.succeed(holding, undefined);
                      yield* Deferred.await(release);
                    }),
                  ),
                ),
              )
              .pipe(Effect.orDie),
          );

          yield* Deferred.await(holding);

          for (const each of devices) yield* each.resume;

          // The database can't answer the pull until the import commits, so the clock moves
          // without waiting for it here.
          let waited = false;

          for (let ticks = 0; ticks < 600 && !waited; ticks++) {
            yield* TestClock.adjust(tick);
            waited = yield* world.server(Invariants.waitingForRows);
          }

          yield* Deferred.succeed(release, undefined);
          yield* Fiber.join(importing);
          yield* world.quiet;

          return waited ? `${done} while a device waited for it` : `${done}, nothing waited`;
        }

        case "Dismiss": {
          const on = yield* device(step.device);

          const exit = yield* on.engine(
            Effect.gen(function* () {
              const sync = yield* SyncClient.Service;
              const [oldest] = yield* on.sql(SyncClient.refusals.run());

              if (oldest === undefined) return "nothing to dismiss";
              yield* sync.dismiss(oldest);
              const earlier = dismissed.get(on.id) ?? [];
              dismissed.set(
                on.id,
                new Set([...earlier, `${oldest.clientId} ${oldest.mutationId}`]),
              );

              return `dismissed #${oldest.mutationId}`;
            }),
          );

          return describe(exit, (done) => done);
        }

        case "Backup": {
          const on = yield* device(step.device);

          yield* on.backup;
          dismissedAtBackup.set(on.id, dismissed.get(on.id) ?? new Set());

          return "backed up";
        }

        case "Restore": {
          const on = yield* device(step.device);

          if (!(yield* on.restore)) return "no backup";
          dismissed.set(on.id, dismissedAtBackup.get(on.id) ?? new Set());

          return "restored the backup";
        }

        case "Admit": {
          yield* world
            .server(
              Effect.flatMap(Spaces.Service, (spaces) =>
                step.admitted
                  ? spaces.addMember(World.school, step.account, "reader")
                  : spaces.removeMember(World.school, step.account),
              ),
            )
            .pipe(Effect.orDie);

          return step.admitted ? "admitted" : "left the school";
        }

        case "Wait": {
          yield* advance(Duration.millis(step.millis));

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
        found.push(...(yield* each.sql(Invariants.cursors(place))));
      }

      for (const account of World.accountIds) {
        found.push(
          ...(yield* world.server(
            Invariants.courseMembership(account, World.accounts[account], choice),
          )),
        );
      }

      found.push(...(yield* world.server(Invariants.plaintextInPostgres)));

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

    const devices = [...world.devices.values()];

    const allIdle = Effect.map(
      Effect.forEach(devices, (each) => each.idle),
      (idle) => idle.every(Boolean),
    );

    /** Lets every device work until all are idle, or breaks liveness. */
    const rest = Effect.fn("Simulation.rest")(function* (label: "settled" | "resumed") {
      yield* until(Effect.succeed(false), settleFor, Duration.seconds(1));

      if (!(yield* until(allIdle, patience))) {
        for (const each of devices) {
          if (!(yield* each.idle)) {
            hung.push({ invariant: "liveness", place: `device ${each.id}`, detail: "never idle" });
          }
        }
      }

      yield* traceEvents;

      for (const each of devices)
        trace.push(`${label} ${each.id} ${yield* syncing(each, Duration.zero)}`);
    });

    /** What must hold once the world is at rest. */
    const atRest = Effect.gen(function* () {
      const found: Array<Invariants.Violation> = [];

      for (const each of world.devices.values()) {
        const place = `device ${each.id}`;
        const state = yield* each.sql(Invariants.settledState);
        const log = yield* world.server(Invariants.serverLog(state.meta.clientId));

        const own = `${state.meta.clientId} `;

        const dismissedHere = new Set(
          [...(dismissed.get(each.id) ?? [])].flatMap((key) =>
            key.startsWith(own) ? [Number(key.slice(own.length))] : [],
          ),
        );

        found.push(...Invariants.nothingLost(place, state, log, dismissedHere));

        found.push(
          ...Invariants.sameSpaces(
            place,
            yield* each.sql(Invariants.deviceSpaces),
            yield* world.server(Invariants.serverSpaces(each.account)),
          ),
        );

        found.push(
          ...Invariants.converged(
            place,
            yield* each.sql(Invariants.deviceRows),
            yield* world.server(Invariants.serverRows(each.account)),
          ),
        );
      }

      return found;
    });

    // A device's first sync is its first pull, which tells it the spaces it reads. Its first
    // backup follows, as a phone makes one the first night.
    for (const each of devices) {
      trace.push(`start ${each.id} ${yield* syncing(each)}`);
      yield* each.backup;
    }

    /** What ran over the wire and on the server, comparable across runs and databases. */
    const result = (): Result => ({
      trace,
      violations,
      faults,
      frames: world
        .frames()
        .map(
          (frame) =>
            `${frame.direction} ${frame.device} ${world.normalized(Predicate.isString(frame.data) ? frame.data : new TextDecoder().decode(frame.data))}`,
        ),
      lines: world.serverLines().map(world.normalized),
    });

    for (const [index, step] of workload.steps.entries()) {
      if (isPadding(step)) continue;
      const done = yield* apply(step);
      trace.push(`${index} ${yield* Effect.orDie(encodeStep(step))} ${done}`);
      yield* traceEvents;

      for (const violation of yield* check) violations.push({ ...violation, step: index });

      if (violations.length > 0) return result();
    }

    // Every device back online at full speed. What is armed stays armed.
    for (const each of devices) {
      yield* each.faults.setOffline(false);
      yield* each.faults.setLatency(Duration.zero);
    }

    // Only pokes bring news now, so a device a poke missed stays behind and shows here.
    yield* rest("settled");

    for (const violation of [...(yield* check), ...(yield* atRest)]) {
      violations.push({ ...violation, step: "settled" });
    }

    if (violations.length > 0) return result();

    // Each app comes to the front once and runs a round, so a fault still armed fires.
    for (const each of devices) yield* each.resume;
    yield* rest("resumed");

    for (const violation of [...(yield* check), ...(yield* atRest)]) {
      violations.push({ ...violation, step: "resumed" });
    }

    return result();
  }).pipe(
    Effect.scoped,
    Random.withSeed(workload.seed),
    // Its warnings come after real time passes, so a loaded machine would log lines an idle one
    // doesn't.
    Effect.provide(TestClock.layer({ warningDelay: Duration.infinity })),
  ) satisfies Effect.Effect<Result, never, SqlClient.SqlClient | Listener.Service>;
