import { useAtomSubscribe } from "@effect/atom-react";
import { useFocusEffect as useNavigationFocusEffect } from "@react-navigation/native";
import { useLayoutEffect as useRouterLayoutEffect } from "@tanstack/react-router";
import { useEvent, useEventListener } from "expo";
import { useFocusEffect } from "expo-router";
import {
  memo,
  useActionState,
  useCallback,
  useEffect,
  useEffectEvent,
  useInsertionEffect,
  useLayoutEffect,
  useMemo,
  useOptimistic,
  useState,
  useSyncExternalStore,
} from "react";
import { useFormState } from "react-dom";

// oxlint-disable-next-line studienbuch/import-boundaries -- fixture: the app bundles the sync server
export { Push } from "@stu/sync/server";

const subscribe = () => () => undefined;
const snapshot = () => 1;
const keyboard = { addListener: subscribe };
const selectedDay = { day: 1 };

export function Timetable() {
  // oxlint-disable-next-line studienbuch/no-ad-hoc-state-or-effects -- fixture: state in a component
  const [day] = useState(1);
  // oxlint-disable-next-line studienbuch/no-ad-hoc-state-or-effects -- fixture: optimistic state in a component
  const [shownDay] = useOptimistic(day);
  // oxlint-disable-next-line studienbuch/no-ad-hoc-state-or-effects -- fixture: action state in a component
  const [saved] = useActionState(snapshot, 0);
  // oxlint-disable-next-line studienbuch/no-ad-hoc-state-or-effects -- fixture: React DOM's action state
  const [legacySaved] = useFormState(snapshot, 0);
  // oxlint-disable-next-line studienbuch/no-ad-hoc-state-or-effects -- fixture: an effect event in a component
  const onShow = useEffectEvent(() => undefined);

  // oxlint-disable-next-line studienbuch/no-ad-hoc-state-or-effects -- fixture: an effect in a component
  useEffect(() => onShow(), []);
  // oxlint-disable-next-line studienbuch/no-ad-hoc-state-or-effects -- fixture: a layout effect in a component
  useLayoutEffect(() => undefined, []);
  // oxlint-disable-next-line studienbuch/no-ad-hoc-state-or-effects -- fixture: an insertion effect in a component
  useInsertionEffect(() => undefined, []);
  // oxlint-disable-next-line studienbuch/no-ad-hoc-state-or-effects -- fixture: a subscription in a component
  const week = useSyncExternalStore(subscribe, snapshot);
  // oxlint-disable-next-line studienbuch/no-ad-hoc-state-or-effects -- fixture: a memoized value in a component
  const label = useMemo(() => `KW ${week}`, [week]);
  // oxlint-disable-next-line studienbuch/no-ad-hoc-state-or-effects -- fixture: a memoized handler in a component
  const select = useCallback(() => day + 1, [day]);
  // oxlint-disable-next-line studienbuch/no-ad-hoc-state-or-effects -- fixture: Expo Router's focus effect
  useFocusEffect(subscribe);
  // oxlint-disable-next-line studienbuch/no-ad-hoc-state-or-effects -- fixture: React Navigation's focus effect
  useNavigationFocusEffect(subscribe);
  // oxlint-disable-next-line studienbuch/no-ad-hoc-state-or-effects -- fixture: TanStack Router's layout effect
  useRouterLayoutEffect(() => undefined, []);
  // oxlint-disable-next-line studienbuch/no-ad-hoc-state-or-effects -- fixture: a callback on every change of an atom
  useAtomSubscribe(selectedDay, subscribe);
  // oxlint-disable-next-line studienbuch/no-ad-hoc-state-or-effects -- fixture: a subscription to a native event
  const shown = useEvent(keyboard, "keyboardDidShow");
  // oxlint-disable-next-line studienbuch/no-ad-hoc-state-or-effects -- fixture: a listener on a native event
  useEventListener(keyboard, "keyboardDidHide", subscribe);

  return [shownDay, saved, legacySaved, label, select, shown];
}

// oxlint-disable-next-line studienbuch/no-ad-hoc-state-or-effects -- fixture: memo
export const MemoTimetable = memo(Timetable);
