import { Organization } from "@stu/core";
import { describe, expect, it } from "vite-plus/test";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { Atom, AtomRegistry } from "effect/unstable/reactivity";
import { accountReactivity, reservationAtom } from "./access.ts";

describe("access atoms", () => {
  it("uses the reservation token as query identity", () => {
    const first = Organization.SchoolAccessReservationToken.make("a".repeat(32));
    const second = Organization.SchoolAccessReservationToken.make("b".repeat(32));

    expect(reservationAtom(first)).toBe(reservationAtom(first));
    expect(reservationAtom(first)).not.toBe(reservationAtom(second));
  });

  it("invalidates account reads only after a successful mutation", async () => {
    let reads = 0;
    const account = Atom.make(() => {
      reads += 1;
      return reads;
    }).pipe(Atom.withReactivity(accountReactivity), Atom.keepAlive);
    const mutation = Atom.runtime(Layer.empty).fn(
      (succeeds: boolean) => (succeeds ? Effect.void : Effect.fail("failed")),
      { reactivityKeys: accountReactivity },
    );
    const registry = AtomRegistry.make();
    expect(registry.get(account)).toBe(1);

    registry.set(mutation, false);
    await Effect.runPromiseExit(
      AtomRegistry.getResult(registry, mutation, { suspendOnWaiting: true }),
    );
    expect(registry.get(account)).toBe(1);

    registry.set(mutation, true);
    await Effect.runPromise(AtomRegistry.getResult(registry, mutation, { suspendOnWaiting: true }));
    expect(registry.get(account)).toBe(2);
    registry.dispose();
  });
});
