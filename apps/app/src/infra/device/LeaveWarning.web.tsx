import { useEffect } from "react";

// A public computer's account lives in the tab's memory (D44), so a reload or closing the tab
// loses what nothing else holds yet, such as a new account's unsaved Notfallkarte. The browser
// asks first, in its own words.

const ask = (event: BeforeUnloadEvent) => event.preventDefault();

/** Asks before a reload or closing the tab while `active`. */
export function useLeaveWarning(active: boolean) {
  useEffect(() => {
    if (!active) return;

    window.addEventListener("beforeunload", ask);

    return () => window.removeEventListener("beforeunload", ask);
  }, [active]);
}

/** `useLeaveWarning` where a screen draws it. */
export function LeaveWarning({ active }: { readonly active: boolean }) {
  useLeaveWarning(active);

  return null;
}
