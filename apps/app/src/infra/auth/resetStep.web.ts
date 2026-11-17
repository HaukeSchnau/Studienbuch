import * as Option from "effect/Option";
import * as KeyValueStore from "effect/persistence/KeyValueStore";
import * as Atom from "effect/reactivity/Atom";
import * as Schema from "effect/Schema";

import { VirtualDevice } from "../device/VirtualDevice.ts";

// resetStep.ts in a browser: the tab's sessionStorage, as the sign-up waiting for its code
// (signUpStore.web.ts), so a phone's browser that drops the tab while the mail is read comes back
// to the code. Another tab and a closed one don't.

const tab = Atom.runtime(KeyValueStore.layerStorage(() => sessionStorage));

/** The address the last reset code in this tab went to. */
export const resetSentTo = Atom.kvs({
  runtime: tab,
  key: `studienbuch:${VirtualDevice.current}:reset-sent-to`,
  schema: Schema.OptionFromNullOr(Schema.String),
  defaultValue: () => Option.none<string>(),
}).pipe(Atom.keepAlive);
