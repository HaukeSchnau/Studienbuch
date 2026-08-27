import { CloudOff } from "lucide-react";
import { useCallback, useSyncExternalStore } from "react";

const subscribe = (onChange: () => void) => {
  globalThis.addEventListener("online", onChange);
  globalThis.addEventListener("offline", onChange);
  return () => {
    globalThis.removeEventListener("online", onChange);
    globalThis.removeEventListener("offline", onChange);
  };
};

/**
 * Whether the browser currently believes it can reach the network.
 *
 * `navigator.onLine` is a weak signal — it knows about the interface, not about whether Studienbuch
 * is answering — so it is only ever used to say "definitely offline". A false negative here would be
 * worse than saying nothing at all.
 */
const useOnline = () => {
  const getSnapshot = useCallback(() => globalThis.navigator?.onLine ?? true, []);
  // Server-rendered as online: the application subtree is client-only, and a strip that flashes on
  // during hydration would be a lie told at exactly the moment the page is least settled.
  return useSyncExternalStore(subscribe, getSnapshot, () => true);
};

/**
 * The chrome's one word about the network.
 *
 * Studienbuch is meant to be usable without a connection, and today it is not: every screen is fed
 * by a request. Until the event log lands, the honest thing for the shell to do is say when the
 * connection is gone, rather than let a stale timetable pass for a current one. The strip is the
 * place that behaviour will grow into — what is queued, what has not synced — and it costs nothing
 * to have somewhere to put it.
 */
export const ConnectionState = () => {
  const online = useOnline();
  if (online) return null;

  return (
    // `output` rather than a div with `role="status"`: same announcement, and the element that
    // already means "a result the page is reporting" needs no ARIA to say so.
    <output className="sticky top-0 z-30 flex items-center justify-center gap-2 bg-alert-des px-4 py-2 text-center text-sm text-ink">
      <CloudOff aria-hidden className="size-4 shrink-0" />
      Keine Verbindung. Was hier steht, kann veraltet sein.
    </output>
  );
};
