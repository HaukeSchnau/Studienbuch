import { useEffect, useState } from "react";

import { useStableCallback } from "./useStableCallback.ts";

interface Tapped {
  readonly checked: boolean;
  readonly reported: boolean;
}

/**
 * A box's checked state that answers a tap at once and reports it `delay` milliseconds later, so a
 * tick draws itself in place before the owner moves the box, as the homework panel re-sorts a card
 * that was ticked. The tapped state shows until `checked` agrees, or for a second after the report
 * if it never does, as when the change was refused.
 */
export function useLaggedToggle(
  checked: boolean,
  onChange: (checked: boolean) => void,
  delay: number,
) {
  const [tapped, setTapped] = useState<Tapped | undefined>(undefined);
  const report = useStableCallback(onChange);

  useEffect(() => {
    if (tapped === undefined) return;

    // After the report, the tapped state gives way once `checked` agrees, or after a second.
    const timer = tapped.reported
      ? setTimeout(() => setTapped(undefined), 1000)
      : setTimeout(() => {
          if (tapped.checked !== checked) report(tapped.checked);

          setTapped({ checked: tapped.checked, reported: true });
        }, delay);

    return () => clearTimeout(timer);
  }, [tapped, checked, delay, report]);

  const shown =
    tapped === undefined || (tapped.reported && tapped.checked === checked)
      ? checked
      : tapped.checked;

  return {
    checked: shown,
    toggle: () => setTapped({ checked: !shown, reported: false }),
  };
}
