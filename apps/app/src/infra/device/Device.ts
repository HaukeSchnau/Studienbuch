import * as Context from "effect/Context";
import * as Layer from "effect/Layer";

// The device a set of layers runs as. The app runs as one; the Sync Lab runs several in one tab,
// each with its own storage, secrets and owner lock.

export * as Device from "./Device.ts";

export interface Options {
  /** `VirtualDevice.current` for the app's own device. The Sync Lab names its own. */
  readonly name: string;
}

export class Service extends Context.Service<Service, Options>()("Device.Service") {}

export const layer = (options: Options) => Layer.succeed(Service)(options);

/**
 * "Öffentlicher Computer" (D44) for the account signed in here: its secrets and database stay in
 * memory, so closing the tab or signing out forgets it and everything it wrote. Its session chose
 * it at sign-in (`SessionStore.Signed`), and `Layers.account` provides it.
 */
export class PublicComputer extends Context.Service<PublicComputer, boolean>()(
  "Device.PublicComputer",
) {}
