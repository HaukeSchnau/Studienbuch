import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

import { Device } from "../device/Device.ts";
import { PendingSignUp } from "./PendingSignUp.ts";

/**
 * A browser keeps the sign-up in the tab's sessionStorage: a reload finds it, another tab and a
 * closed one don't, which also suits a public computer.
 */
export const layer = Layer.effect(PendingSignUp.Store)(
  Effect.map(Device.Service, (device) => {
    const key = `studienbuch:${device.name}:sign-up`;

    const attempt = <A>(run: () => A) =>
      Effect.try({ try: run, catch: (cause) => new PendingSignUp.Unavailable({ cause }) });

    return {
      get: attempt(() => Option.fromNullishOr(sessionStorage.getItem(key))),
      set: (text) => attempt(() => sessionStorage.setItem(key, text)),
      remove: attempt(() => sessionStorage.removeItem(key)),
    };
  }),
);
