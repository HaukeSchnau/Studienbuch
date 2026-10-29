import * as Option from "effect/Option";
import { Platform } from "react-native";

// In a browser, `?device=a` and `?device=b` are two devices side by side, each with its own storage
// and owner tab (AGENTS.md, glossary; ADR 0014). A tab plays the device it was opened as. A phone is
// always just itself.

export * as VirtualDevice from "./VirtualDevice.ts";

const valid = /^[a-z0-9-]{1,32}$/u;

/** The device named by `?device=`, or none for the browser's own. */
export const name: Option.Option<string> =
  Platform.OS === "web"
    ? Option.fromNullishOr(new URLSearchParams(window.location.search).get("device")).pipe(
        Option.filter((device) => valid.test(device)),
      )
    : Option.none();

/** The device this tab plays, as `Device.Options.name` takes it. */
export const current = Option.getOrElse(name, () => (Platform.OS === "web" ? "browser" : "phone"));
