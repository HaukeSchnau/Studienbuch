import { Demo } from "@stu/api/Demo";
import type { Ports } from "@stu/sync/client";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import type * as HttpClient from "effect/http/HttpClient";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";

import { LabServer } from "./LabServer.ts";

// Where the Lab's devices get their sessions: the demo school's Lena and Tom. Devices A and B are
// Lena, C is Tom. Each device signs in with a session of its own, as two phones would, and gets
// the account's root key with it.

export * as LabAccounts from "./LabAccounts.ts";

export const Persona = Demo.Persona;

export type Persona = Demo.Persona;

export const names: Record<Persona, string> = { lena: "Lena", tom: "Tom" };

export interface Account {
  readonly accountId: string;
  readonly token: Redacted.Redacted;
  /** The account's root key, the same on every sign-in, which the device unlocks with. */
  readonly rootKey: Uint8Array;
}

export class Failed extends Schema.TaggedError<Failed, { readonly brand: unique symbol }>()(
  "LabAccounts.Failed",
  { persona: Persona, cause: Schema.Defect() },
) {}

export class Service extends Context.Service<
  Service,
  {
    /** A new session for the persona's account, for one device. */
    readonly signIn: (persona: Persona) => Effect.Effect<Account, Failed>;
  }
>()("LabAccounts.Service") {}

/** `Demo.signIn`, which development and preview servers answer. */
export const demo = Layer.effect(Service)(
  Effect.gen(function* () {
    const services = yield* Effect.context<Ports.Server | HttpClient.HttpClient>();

    const signIn = Effect.fn("LabAccounts.signIn")(function* (persona: Persona) {
      const session = yield* Effect.scoped(
        Effect.flatMap(LabServer.api(Option.none()), (client) =>
          client["Demo.signIn"]({ persona }),
        ),
      ).pipe(Effect.provide(services));

      return {
        accountId: session.account,
        token: Redacted.make(session.token),
        rootKey: session.rootKey,
      } satisfies Account;
    });

    return Service.of({
      signIn: (persona) =>
        signIn(persona).pipe(Effect.mapError((cause) => new Failed({ persona, cause }))),
    });
  }),
);
