import { DateTime as Barrel } from "effect";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
// oxlint-disable-next-line studienbuch/no-ambient-clock-or-random -- fixture: a named import of the clock
import { nowUnsafe } from "effect/DateTime";

// oxlint-disable-next-line studienbuch/no-ambient-clock-or-random -- fixture: DateTime.now in core
export const stamped = DateTime.now;

// oxlint-disable-next-line studienbuch/no-ambient-clock-or-random -- fixture: DateTime.nowInCurrentZone in core
export const zoned = DateTime.nowInCurrentZone;

// oxlint-disable-next-line studienbuch/no-ambient-clock-or-random -- fixture: DateTime.now through the effect barrel
export const barrel = Barrel.now;

export const unsafe = nowUnsafe;

// oxlint-disable-next-line studienbuch/no-ambient-clock-or-random -- fixture: Effect.sleep in core
export const pause = Effect.sleep("1 second");

// oxlint-disable-next-line studienbuch/no-ambient-clock-or-random -- fixture: Effect.clockWith in core
export const millis = Effect.clockWith((clock: { readonly currentTimeMillis: number }) => clock);

// oxlint-disable-next-line studienbuch/no-ambient-clock-or-random -- fixture: the host's time zone
export const here = DateTime.zoneMakeLocal;

// oxlint-disable-next-line studienbuch/no-ambient-clock-or-random -- fixture: a layer of the host's time zone
export const hereLayer = DateTime.layerCurrentZoneLocal;

// oxlint-disable-next-line studienbuch/no-ambient-clock-or-random -- fixture: an effect in the host's time zone
export const inHere = DateTime.withCurrentZoneLocal;

// oxlint-disable-next-line studienbuch/no-ambient-clock-or-random -- fixture: a date shown in the host's time zone
export const shown = DateTime.formatLocal;

// oxlint-disable-next-line studienbuch/no-ambient-clock-or-random -- fixture: a cache that expires by the clock
export const cachedRows = Effect.cachedWithTTL;

// oxlint-disable-next-line studienbuch/no-ambient-clock-or-random -- fixture: an invalidatable cache that expires by the clock
export const invalidatable = Effect.cachedInvalidateWithTTL;

// oxlint-disable-next-line studienbuch/no-ambient-clock-or-random -- fixture: crypto.getRandomValues in core
export const noise = () => crypto.getRandomValues(new Uint8Array(16));

// oxlint-disable-next-line studienbuch/no-ambient-clock-or-random -- fixture: globalThis.crypto in core
export const subtle = () => globalThis.crypto.subtle;

// oxlint-disable-next-line studienbuch/no-ambient-clock-or-random -- fixture: performance.now in core
export const started = () => performance.now();

// A fixed instant, a local named crypto and a property named performance read no clock.
export const epoch = DateTime.make(0);
export const local = (crypto: { readonly id: string }) => crypto.id;
export const nested = { performance: 1 }.performance;
