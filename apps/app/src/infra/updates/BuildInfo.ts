import * as Option from "effect/Option";
import * as Updates from "expo-updates";
import { Platform } from "react-native";

// Which JavaScript this app runs. Release steps set EXPO_PUBLIC_REVISION for store builds and
// updates. The web export stays without one, because one bundle serves every deployment and its
// server reports the revision (ADR 0005).

export * as BuildInfo from "./BuildInfo.ts";

/**
 * Whether the server delivered this JavaScript, as it does to a browser. The server's revision is
 * then the app's.
 */
export const servedByServer = Platform.OS === "web";

/** The git revision this JavaScript was built from. None in a build from a working copy. */
export const revision: Option.Option<string> = servedByServer
  ? Option.none()
  : Option.fromNullishOr(process.env.EXPO_PUBLIC_REVISION).pipe(
      Option.filter((value) => value !== ""),
    );

export interface Update {
  readonly id: string;
  /** The update that shipped inside the binary, not one EAS Update delivered. */
  readonly embedded: boolean;
  readonly runtimeVersion: Option.Option<string>;
  readonly channel: Option.Option<string>;
}

/** The running update. None on the web and in development builds, where expo-updates is off. */
export const update: Option.Option<Update> = Option.map(
  Option.fromNullishOr(Updates.isEnabled ? Updates.updateId : null),
  (id) => ({
    id,
    embedded: Updates.isEmbeddedLaunch,
    runtimeVersion: Option.fromNullishOr(Updates.runtimeVersion),
    channel: Option.fromNullishOr(Updates.channel),
  }),
);
