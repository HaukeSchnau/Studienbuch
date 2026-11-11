import { useEffect, useState } from "react";

import { useStableCallback } from "./useStableCallback.ts";

/**
 * The ids in the order a list shows them, given the order it showed last: that order while the list
 * holds the same ids sorted another way, and the new order once ids came or went.
 */
export const lingeringOrder = (
  shown: ReadonlyArray<string>,
  sorted: ReadonlyArray<string>,
): ReadonlyArray<string> => {
  const now = new Set(sorted);

  return shown.length === sorted.length && shown.every((id) => now.has(id)) ? shown : sorted;
};

/**
 * A list's items in the order they were last shown, until `delay` milliseconds after they last
 * changed places. A card the student just ticked then stays under the finger, shows its tick and can
 * be unticked, before it moves to where the list sorts it. Items that come or go show at once.
 */
export function useLingeringOrder<A>(
  items: ReadonlyArray<A>,
  idOf: (item: A) => string,
  delay: number,
): ReadonlyArray<A> {
  const sorted = items.map(idOf);
  const [shown, setShown] = useState(sorted);
  const order = lingeringOrder(shown, sorted);
  const settle = useStableCallback(() => setShown(sorted));
  // Strings, so the timer starts again when an order changes, not on every render.
  const shownKey = shown.join("\n");
  const sortedKey = sorted.join("\n");
  const lingers = order === shown;

  useEffect(() => {
    if (shownKey === sortedKey) return;

    const timer = setTimeout(settle, lingers ? delay : 0);

    return () => clearTimeout(timer);
  }, [shownKey, sortedKey, lingers, delay, settle]);

  if (order === sorted || shownKey === sortedKey) return items;

  const byId = new Map(items.map((item) => [idOf(item), item]));

  return order.flatMap((id) => {
    const item = byId.get(id);

    return item === undefined ? [] : [item];
  });
}
