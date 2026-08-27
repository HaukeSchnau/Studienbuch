import { Organization } from "@stu/core/organization";

const storageKey = "studienbuch.context";

/**
 * Which context this browser was last in.
 *
 * Remembered so that opening the application returns someone where they were rather than to
 * whichever context happens to sort first — for a teacher who is also the operator, that difference
 * is every single visit.
 *
 * `localStorage` rather than the `KeyValueStore` service `docs/effect-architecture.md` nominates for
 * device settings: this is read synchronously during the first render of the shell, and it is a
 * navigational preference rather than data. It moves when there is a second such preference to keep
 * it company. Every access is guarded because this module is evaluated during server rendering too.
 */
export const rememberedContext = (): ReadonlyArray<string> => {
  try {
    return globalThis.localStorage?.getItem(storageKey)?.split("/") ?? [];
  } catch {
    // A browser with storage disabled has no memory, which is a smaller problem than a crash.
    return [];
  }
};

export const rememberContext = (context: Organization.ContextRef) => {
  try {
    globalThis.localStorage?.setItem(storageKey, Organization.contextSegments(context).join("/"));
  } catch {
    // Nothing to do: the next visit simply starts at the first context.
  }
};

/** Forgets the choice, so the next person to sign in on this browser starts fresh. */
export const forgetContext = () => {
  try {
    globalThis.localStorage?.removeItem(storageKey);
  } catch {
    // Nothing to do: a browser that cannot store this had nothing to forget.
  }
};
