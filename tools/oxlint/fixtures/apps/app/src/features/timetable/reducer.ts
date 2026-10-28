import { Homework } from "@stu/core";
import { useReducer } from "react";

const advance = (week: number, step: number) => week + step;

function reset() {
  return 0;
}

export function WeekPicker() {
  const [week] = useReducer(advance, 0);
  const [cleared] = useReducer(reset, 0);
  const [homework] = useReducer(Homework.reduce, Homework.initial);
  // oxlint-disable-next-line studienbuch/no-ad-hoc-state-or-effects -- fixture: an inline reducer
  const [inline] = useReducer((current: number, step: number) => current + step, 0);

  function local(current: number) {
    return current;
  }

  // oxlint-disable-next-line studienbuch/no-ad-hoc-state-or-effects -- fixture: a reducer declared inside the component
  const [nested] = useReducer(local, 0);

  return [week, cleared, homework, inline, nested];
}
