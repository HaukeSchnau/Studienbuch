import * as Context from "effect/Context";
import * as Layer from "effect/Layer";

// The device a set of layers runs as. The app runs as one; the Sync Lab runs several in one tab,
// each with its own storage, secrets and owner lock.

export * as Device from "./Device.ts";

export interface Options {
  /** `VirtualDevice.current` for the app's own device. The Sync Lab names its own. */
  readonly name: string;
  /**
   * "Öffentlicher Computer" (D44): secrets and the database stay in memory, so closing the tab
   * forgets the account and everything it wrote.
   */
  readonly publicComputer: boolean;
}

export class Service extends Context.Service<Service, Options>()("Device.Service") {}

export const layer = (options: Options) => Layer.succeed(Service)(options);
