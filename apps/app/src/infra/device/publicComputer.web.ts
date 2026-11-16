import * as KeyValueStore from "effect/persistence/KeyValueStore";
import * as Atom from "effect/reactivity/Atom";
import * as Schema from "effect/Schema";

import { VirtualDevice } from "./VirtualDevice.ts";

// "Öffentlicher Computer" (D44): the account that signs in next keeps its session, secrets and
// database in memory, so closing the tab or signing out leaves nothing of it behind. The choice
// lives in the tab's sessionStorage, which keeps it across a reload and drops it with the tab.

const tab = Atom.runtime(KeyValueStore.layerStorage(() => sessionStorage));

/** Whether the next sign-in in this tab keeps its account in memory only. */
export const publicComputer = Atom.kvs({
  runtime: tab,
  key: `studienbuch:${VirtualDevice.current}:public-computer`,
  schema: Schema.Boolean,
  defaultValue: () => false,
}).pipe(Atom.keepAlive);
