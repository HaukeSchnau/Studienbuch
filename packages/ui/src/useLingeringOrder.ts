import { useEffect, useState } from "react";

/**
 * A list's items in the order they were last shown, until `delay` milliseconds after they changed
 * places. A card the student just ticked then stays under the finger, shows its tick and can be
 * unticked, before it moves to where the list sorts it. Items that come or go show at once.
 */
export function useLingeringOrder<A>(
  items: ReadonlyArray<A>,
  idOf: (item: A) => string,
  delay: number,
): ReadonlyArray<A> {
  const sorted = items.map(idOf);
  const [shown, setShown] = useState(sorted);
  const sortedKey = sorted.join("\n");
  const moved = shown.join("\n") !== sortedKey;
  // The same items in another order. Anything else is a new list, which shows as it is.
  const reordered = moved && [...shown].sort().join("\n") === [...sorted].sort().join("\n");

  useEffect(() => {
    if (!moved) return;

    const timer = setTimeout(() => setShown(sortedKey.split("\n")), reordered ? delay : 0);

    return () => clearTimeout(timer);
  }, [moved, reordered, sortedKey, delay]);

  if (!reordered) return items;

  const byId = new Map(items.map((item) => [idOf(item), item]));

  return shown.flatMap((id) => {
    const item = byId.get(id);

    return item === undefined ? [] : [item];
  });
}
