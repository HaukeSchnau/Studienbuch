// quick-crypto replaces `globalThis.crypto` on iOS and Android. It installs before the router loads
// any other module, so nothing can capture the runtime's missing `crypto` first.
// oxlint-disable-next-line import/no-unassigned-import -- installing is the import's purpose
import "./src/infra/crypto/runtime.ts";
// oxlint-disable-next-line import/no-unassigned-import -- Expo Router's entry registers the app
import "expo-router/entry";

import { ServiceWorker } from "./src/infra/offline/ServiceWorker.ts";

ServiceWorker.register();
