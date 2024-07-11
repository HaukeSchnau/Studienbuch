import { describe, expect, it } from "vitest";

import { parseTimetableCell } from "./parse-timetable-cell";

describe("parseTimetableCell", () => {
  it("should parse timetable cell with single course", () => {
    const result = parseTimetableCell(
      `*ch2
MUE KH-15
de2
OLB KH-01
*mu23 HEI
*ds1
TIM OH-7`,
    );

    expect(result).toEqual([
      {
        subject: "*ch2",
        guessedSubject: "Chemie",
        isChoosable: true,
        normalizedCourseId: "ch2",
        room: "KH-15",
        teacher: "MUE",
      },
      {
        subject: "de2",
        guessedSubject: "Deutsch",
        isChoosable: false,
        normalizedCourseId: "de2",
        room: "KH-01",
        teacher: "OLB",
      },
      {
        subject: "*mu23",
        guessedSubject: "Musik",
        isChoosable: true,
        normalizedCourseId: "mu23",
        room: undefined,
        teacher: "HEI",
      },
      {
        subject: "*ds1",
        guessedSubject: "Darstellendes Spiel",
        isChoosable: true,
        normalizedCourseId: "ds1",
        room: "OH-7",
        teacher: "TIM",
      },
    ]);
  });
});
