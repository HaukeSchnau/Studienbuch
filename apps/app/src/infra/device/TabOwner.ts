// One tab owns a device's database in the browser (ADR 0014). The owner holds a Web Lock for its
// document's lifetime, and the browser drops it with the document, its SQLite worker and their
// OPFS handles. Other tabs of the device park. "Hier verwenden" asks the owner over a
// BroadcastChannel to reload into the parked state, then waits for the lock.

import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { use, useState } from "react";

export * as TabOwner from "./TabOwner.ts";

/** Another tab owns the device, so this one may not open its storage. */
export class InUse extends Schema.TaggedError<InUse, { readonly brand: unique symbol }>()(
  "TabOwner.InUse",
  { device: Schema.String },
) {}

export type Ownership = "owner" | "parked";

const lockName = (device: string) => `studienbuch:${device}`;
const parkedKey = (device: string) => `studienbuch:${device}:parked`;
const release = "release";

const holdUntilTheDocumentDies = () => new Promise<void>(() => {});

const releaseWhenAsked = (device: string) => {
  new BroadcastChannel(lockName(device)).addEventListener("message", (event) => {
    if (event.data !== release) return;
    sessionStorage.setItem(parkedKey(device), "1");
    window.location.reload();
  });
};

const claims = new Map<string, Promise<Ownership>>();

/** Whether this tab may open the device's database. Asks once per document. */
export const claim = (device: string) => {
  const existing = claims.get(device);

  if (existing !== undefined) return existing;

  const claimed =
    sessionStorage.getItem(parkedKey(device)) === null
      ? new Promise<Ownership>((resolve) => {
          void navigator.locks.request(lockName(device), { ifAvailable: true }, (lock) => {
            if (lock === null) {
              resolve("parked");

              return undefined;
            }

            releaseWhenAsked(device);
            resolve("owner");

            return holdUntilTheDocumentDies();
          });
        })
      : Promise.resolve<Ownership>("parked");

  claims.set(device, claimed);

  return claimed;
};

/**
 * Succeeds once this tab owns the device, for the code that opens its storage: a second worker on
 * the same OPFS directory waits forever instead of failing (ADR 0014).
 */
export const own = (device: string) =>
  Effect.flatMap(
    Effect.promise(() => claim(device)),
    (ownership) => (ownership === "owner" ? Effect.void : Effect.fail(new InUse({ device }))),
  );

/** "Hier verwenden": the owner reloads into the parked state. Resolves once this tab owns the device. */
export const takeOver = (device: string) => {
  sessionStorage.removeItem(parkedKey(device));

  return new Promise<void>((resolve) => {
    void navigator.locks.request(lockName(device), () => {
      releaseWhenAsked(device);
      claims.set(device, Promise.resolve("owner"));
      resolve();

      return holdUntilTheDocumentDies();
    });
    const channel = new BroadcastChannel(lockName(device));
    // oxlint-disable-next-line unicorn/require-post-message-target-origin -- a BroadcastChannel takes no target origin
    channel.postMessage(release);
    channel.close();
  });
};

/**
 * This tab's ownership of `device`, for the gate that renders the app only in the owner. Suspends
 * until the browser answers the first claim. `takeOver` is "Hier verwenden": the state reads
 * "taking over" until the other tab let go, then "owner".
 */
export function useOwnership(device: string) {
  const [state, setState] = useState<Ownership | "taking over">(use(claim(device)));

  return {
    state,
    takeOver: () => {
      setState("taking over");
      void takeOver(device).then(() => setState("owner"));
    },
  };
}
