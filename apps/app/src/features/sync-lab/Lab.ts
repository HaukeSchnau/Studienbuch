import { System } from "@stu/api/System";
import { CryptoSuite } from "@stu/e2ee";
import type { Inspect } from "@stu/sync";
import type { Outbox, Ports } from "@stu/sync/client";
import { Faults } from "@stu/sync/lab";
import * as Context from "effect/Context";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import type * as HttpClient from "effect/http/HttpClient";
import * as Option from "effect/Option";
import * as Record from "effect/Record";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import * as Schema from "effect/Schema";
import * as Stream from "effect/Stream";
import * as SubscriptionRef from "effect/SubscriptionRef";

import { ApiProtocol } from "../../infra/api/ApiProtocol.ts";
import { ServerOrigin } from "../../infra/api/ServerOrigin.ts";
import { layer as keychain } from "../../infra/keychain/platform.ts";
import { Agreement } from "./Agreement.ts";
import { Panel } from "./Panel.ts";
import { LabAccounts } from "./LabAccounts.ts";
import { LabDevice } from "./LabDevice.ts";
import { LabServer } from "./LabServer.ts";

// The Sync Lab at /app/dev/sync-lab: three devices with real engines against the server that
// serves the page, and that server's own view of their spaces (sync.md, "Sync Lab"). The route
// loads this module only after `System.info` answered development or preview, and the faults
// themselves require that answer again.

export * as Lab from "./Lab.ts";

/** A server that isn't a development or preview server keeps its faults off. */
export class Unavailable extends Schema.TaggedError<
  Unavailable,
  { readonly brand: unique symbol }
>()("SyncLab.Unavailable", { environment: System.Environment }) {}

const allowed = Layer.effect(Faults.Allowed)(
  Effect.gen(function* () {
    const client = yield* LabServer.api(Option.none());
    const { environment } = yield* client["System.info"]();

    return environment === "development" || environment === "preview"
      ? { environment }
      : yield* new Unavailable({ environment });
  }).pipe(Effect.scoped),
);

/** How often the server panel asks the server again. */
const every = "1 second";

export class Service extends Context.Service<
  Service,
  {
    readonly device: (id: LabDevice.Id) => LabDevice.LabDevice;
    /** The device's newest snapshot, `None` before its engine first ran. */
    readonly latest: (id: LabDevice.Id) => Option.Option<LabDevice.Snapshot>;
    /** The server's view of the devices' spaces and clients, `None` while it doesn't answer. */
    readonly server: Stream.Stream<Option.Option<Inspect.Response>>;
  }
>()("SyncLab.Service") {}

const make = Effect.gen(function* () {
  const devices = yield* Effect.all(Record.map(LabDevice.specs, LabDevice.make));
  // The newest snapshot of each device, for the server panel's question and the forges.
  const newest = new Map<LabDevice.Id, LabDevice.Snapshot>();

  for (const id of LabDevice.ids) {
    yield* devices[id].snapshots.pipe(
      Stream.runForEach((snapshot) => Effect.sync(() => void newest.set(id, snapshot))),
      Effect.forkScoped,
    );
  }

  const tokens = Effect.forEach(Object.values(devices), (each) => Effect.option(each.token)).pipe(
    Effect.map((all) => Option.firstSomeOf(all.map(Option.flatten))),
  );

  const ask = Effect.gen(function* () {
    const token = yield* tokens;

    if (Option.isNone(token)) return Option.none<Inspect.Response>();

    const snapshots = [...newest.values()];

    const request = {
      spaces: [
        ...new Set(snapshots.flatMap((snapshot) => snapshot.spaces.map((space) => space.id))),
      ],
      clients: snapshots.flatMap((snapshot) =>
        snapshot.clientId === "" ? [] : [snapshot.clientId],
      ),
      limit: 1000,
    } satisfies Inspect.Request;

    return yield* LabServer.inspect(token.value, request).pipe(Effect.option);
  });

  const services = yield* Effect.context<Ports.Server | HttpClient.HttpClient>();

  return Service.of({
    device: (id) => devices[id],
    latest: (id) => Option.fromNullishOr(newest.get(id)),
    server: Stream.tick(every).pipe(
      Stream.mapEffect(() => Effect.provide(ask, services)),
      Stream.changesWith((a, b) => JSON.stringify(a) === JSON.stringify(b)),
    ),
  });
});

export const layer = Layer.effect(Service)(make).pipe(
  Layer.provide(LabAccounts.demo),
  Layer.provideMerge(allowed),
  Layer.provideMerge(
    Layer.mergeAll(ServerOrigin.layer, ApiProtocol.httpClient, keychain, CryptoSuite.layer),
  ),
);

const runtime = Atom.runtime(layer).pipe(Atom.keepAlive);

const lab = Service;

const ofDevice = <A, E>(
  id: LabDevice.Id,
  stream: (device: LabDevice.LabDevice) => Stream.Stream<A, E>,
) => runtime.atom(Stream.unwrap(Effect.map(lab, (each) => stream(each.device(id)))));

/** Whether a device's engine runs, starts or failed. */
export const engine = Atom.family((id: LabDevice.Id) =>
  ofDevice(id, (device) => SubscriptionRef.changes(device.engine)),
);

export const snapshot = Atom.family((id: LabDevice.Id) =>
  ofDevice(id, (device) => device.snapshots),
);

export const status = Atom.family((id: LabDevice.Id) => ofDevice(id, (device) => device.statuses));

export const settings = Atom.family((id: LabDevice.Id) =>
  ofDevice(id, (device) => SubscriptionRef.changes(device.faults.settings)),
);

export const server = runtime.atom(Stream.unwrap(Effect.map(lab, (each) => each.server)));

/** The homework title a device's field holds until it is added. */
export const draft = Atom.family((_id: LabDevice.Id) => Atom.make(""));

export type Action = Data.TaggedEnum<{
  Offline: { readonly device: LabDevice.Id; readonly offline: boolean };
  Latency: { readonly device: LabDevice.Id; readonly millis: number };
  Arm: { readonly device: LabDevice.Id; readonly fault: Faults.OneShot };
  Crash: { readonly device: LabDevice.Id };
  Wipe: { readonly device: LabDevice.Id };
  Add: { readonly device: LabDevice.Id; readonly title: string };
  SealIntoOther: { readonly device: LabDevice.Id };
  ChooseNotOffered: { readonly device: LabDevice.Id };
  Dismiss: { readonly device: LabDevice.Id; readonly refusal: Outbox.Rejected };
}>;

export const Action = Data.taggedEnum<Action>();

/** The device of the other persona hasn't pulled its notebook yet. */
export class NoOtherNotebook extends Schema.TaggedError<
  NoOtherNotebook,
  { readonly brand: unique symbol }
>()("SyncLab.NoOtherNotebook", {}) {}

/** The other persona's notebook, as the device that plays that persona last read it. */
const otherNotebook = (device: LabDevice.LabDevice, all: Service["Service"]) =>
  Effect.fromOption(
    Option.firstSomeOf(
      LabDevice.ids.flatMap((id) =>
        LabDevice.specs[id].persona === device.spec.persona
          ? []
          : [
              Option.flatMap(all.latest(id), (theirs) =>
                Option.map(theirs.enrollment, (enrollment) => enrollment.notebook),
              ),
            ],
      ),
    ),
  ).pipe(Effect.mapError(() => new NoOtherNotebook()));

const perform = Effect.fn("SyncLab.perform")(function* (action: Action) {
  const all = yield* lab;
  const device = all.device(action.device);

  switch (action._tag) {
    case "Offline":
      return yield* device.faults.setOffline(action.offline);
    case "Latency":
      return yield* device.setLatency(action.millis);
    case "Arm":
      return yield* device.faults.arm(action.fault);
    case "Crash":
      return yield* device.crash;
    case "Wipe":
      return yield* device.wipe;
    case "Add":
      return yield* Effect.asVoid(device.addHomework(action.title));
    case "SealIntoOther":
      return yield* Effect.asVoid(device.sealInto(yield* otherNotebook(device, all)));
    case "ChooseNotOffered":
      return yield* Effect.asVoid(device.chooseNotOffered());
    case "Dismiss":
      return yield* device.dismiss(action.refusal);
  }
});

/** Runs one control of a device. The pane shows the last one's failure. */
export const act = Atom.family((_device: LabDevice.Id) =>
  // A second click mustn't interrupt the first one's write.
  runtime.fn(perform, { concurrent: true }),
);

/** The bar: what keeps each device from agreeing with the server, once everything answered. */
export const agreement = Atom.make((get) => {
  const answer = AsyncResult.value(get(server)).pipe(Option.flatten);

  if (Option.isNone(answer)) return Option.none<ReadonlyArray<Agreement.Judged>>();

  const devices = LabDevice.ids.map((id) => {
    const current = AsyncResult.value(get(engine(id)));
    const held = AsyncResult.value(get(snapshot(id)));
    const connection = AsyncResult.value(get(status(id)));

    return Option.isSome(current) &&
      current.value._tag === "Running" &&
      Option.isSome(held) &&
      Option.isSome(connection)
      ? Option.some({
          id,
          accountId: current.value.accountId,
          online: connection.value.connection === "online",
          snapshot: held.value,
        })
      : Option.none();
  });

  return Option.map(Option.all(devices), (all) => Agreement.judge(all, answer.value));
});

/** The server panel, once the server answered. */
export const panel = Atom.make((get) =>
  Option.map(Option.flatten(AsyncResult.value(get(server))), (response) =>
    Panel.describe(
      response,
      LabDevice.ids.map((id) => {
        const current = Option.getOrUndefined(AsyncResult.value(get(engine(id))));

        return {
          id,
          accountId: current?._tag === "Running" ? current.accountId : undefined,
          snapshot: Option.getOrUndefined(AsyncResult.value(get(snapshot(id)))),
        };
      }),
    ),
  ),
);
