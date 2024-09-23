import { describe, expect, it } from "vitest";

import { mapRow } from "./parse-schedule-csv";

describe("parse-schedule-csv", () => {
  it("should map row", () => {
    const cellValue = `*ch2
    MUE KH-15`;

    const expectedCellValue = [
      {
        subject: "*ch2",
        isMandatory: false,
        normalizedCourseId: "ch2",
        room: "KH-15",
        teacher: "MUE",
      },
    ];

    const row = {
      "": "8:00\n8:40",
      Montag: cellValue,
      Dienstag: "",
      Mittwoch: cellValue,
      Donnerstag: "",
      Freitag: cellValue,
    };

    const result = mapRow(row);

    expect(result).toEqual({
      startMinutes: 8 * 60,
      endMinutes: 9 * 60 + 20,
      cols: [expectedCellValue, [], expectedCellValue, [], expectedCellValue],
    });
  });
});
