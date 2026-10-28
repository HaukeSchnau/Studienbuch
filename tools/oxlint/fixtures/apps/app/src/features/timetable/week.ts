import * as React from "react";
import { useEffect, useState as useLocalState } from "react";

/** The week the timetable shows, starting at `first`. It survives re-renders, not a remount. */
export function useShownWeek(first: number) {
  const [week, setWeek] = useLocalState(first);

  return [week, setWeek] as const;
}

/** Scrolls the timetable to today once it is on screen. */
export const useScrollToToday = () => {
  React.useEffect(() => undefined, []);
};

export function Week() {
  // oxlint-disable-next-line studienbuch/no-ad-hoc-state-or-effects -- fixture: an aliased import
  const [week] = useLocalState(1);
  // oxlint-disable-next-line studienbuch/no-ad-hoc-state-or-effects -- fixture: a namespace import
  const [day] = React.useState(1);

  return week + day;
}

// oxlint-disable-next-line studienbuch/no-ad-hoc-state-or-effects -- fixture: memo through the namespace
export const MemoWeek = React.memo(Week);

export function useUndocumentedWeek() {
  // oxlint-disable-next-line studienbuch/no-ad-hoc-state-or-effects -- fixture: a hook without a doc comment
  useEffect(() => undefined, []);
}

/** The week, kept in a hook that isn't exported. */
function usePrivateWeek() {
  // oxlint-disable-next-line studienbuch/no-ad-hoc-state-or-effects -- fixture: a hook that isn't exported
  const [week] = useLocalState(1);

  return week;
}

export const privateWeek = usePrivateWeek;

/** A label for `week`. */
// oxlint-disable-next-line studienbuch/no-hookless-use-function -- fixture: a use function without a hook
export const useWeekLabel = (week: number) => `KW ${week}`;
