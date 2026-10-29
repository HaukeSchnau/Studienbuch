import { describe, expect, it } from "@effect/vitest";
import * as Calendar from "temporal-polyfill/fns/Calendar";
import * as PlainDateFns from "temporal-polyfill/fns/PlainDate";

import { Due } from "./Due.ts";

const date = (iso: string) => PlainDateFns.fromString(iso, Calendar.getISO);

// Wednesday, 28 October 2026.
const today = date("2026-10-28");

describe("Due", () => {
  it.each([
    ["2026-10-28", "Heute fällig"],
    ["2026-10-29", "Bis morgen"],
    ["2026-11-03", "Bis Dienstag"],
    ["2026-11-04", "Bis Mi, 4.11."],
    ["2027-10-27", "Bis Mi, 27.10.2027"],
    ["2026-10-27", "Überfällig seit gestern"],
    ["2026-10-22", "Überfällig seit Donnerstag"],
    ["2026-10-21", "Überfällig seit 21.10."],
    ["2025-12-30", "Überfällig seit 30.12.2025"],
  ])("labels open homework due on %s as %s", (dueOn, label) => {
    expect(Due.label({ id: "a", dueOn: date(dueOn) }, today)).toBe(label);
  });

  it.each([
    ["2026-10-28", "Heute erledigt"],
    ["2026-10-27", "Gestern erledigt"],
    ["2026-10-22", "Erledigt am Donnerstag"],
    ["2026-10-21", "Erledigt am 21.10."],
    ["2025-12-30", "Erledigt am 30.12.2025"],
  ])("labels homework done on %s as %s, whatever its due date", (doneOn, label) => {
    expect(Due.label({ id: "a", dueOn: date("2026-10-01"), doneOn: date(doneOn) }, today)).toBe(
      label,
    );
  });
});
