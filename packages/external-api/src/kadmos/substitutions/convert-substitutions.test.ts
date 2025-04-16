import { fromPartial } from "@total-typescript/shoehorn";
import { describe, expect, it } from "vitest";

import {
  addRowSpans,
  convertKadmosRowsToSubstitutionsTable,
  getSubstituionTableColumns,
} from "./convert-substitutions";

describe("convertSubstitutions", () => {
  it("should add row spans", () => {
    const result = addRowSpans([
      { time: "1", class: "A", subject: "Math" },
      { time: "2", class: "B", subject: "English" },
    ]);

    expect(result).toEqual([
      {
        time: { data: "1", rowSpan: 1 },
        class: { data: "A", rowSpan: 1 },
        subject: { data: "Math", rowSpan: 1 },
      },
      {
        time: { data: "2", rowSpan: 1 },
        class: { data: "B", rowSpan: 1 },
        subject: { data: "English", rowSpan: 1 },
      },
    ]);
  });

  it("should convert kadmos rows to substitutions table", () => {
    const result = convertKadmosRowsToSubstitutionsTable(
      [{ data: ["1", "A", "Math"] }, { data: ["2", "B", "English"] }],
      [
        {
          key: "hour",
          name: "Stunde",
          condition: "showHour",
        },
        {
          key: "class",
          name: "Klassen",
          condition: "showClass",
        },
        {
          key: "subject",
          name: "Fach",
          condition: "showSubject",
        },
      ],
    );

    expect(result).toEqual([
      {
        hour: "1",
        class: "A",
        subject: "Math",
        substitute: "",
      },
      {
        hour: "2",
        class: "B",
        subject: "English",
        substitute: "",
      },
    ]);
  });

  it("should get substitution table columns", () => {
    const result = getSubstituionTableColumns(
      fromPartial({
        showHour: true,
        showTime: true,
        showClass: false,
        showStudentgroup: true,
        showSubject: true,
        showRoom: false,
        showTeacher: true,
        showInfo: false,
        showSubstText: true,
      }),
    );

    expect(result).toHaveLength(7);
    expect(result).toContainEqual({
      key: "hour",
      name: "Stunde",
      condition: "showHour",
    });
    expect(result).toContainEqual({
      key: "time",
      name: "Zeit",
      condition: "showTime",
    });
    expect(result).not.toContainEqual({
      key: "class",
      name: "Klassen",
      condition: "showClass",
    });
    expect(result).toContainEqual({
      key: "studentGroup",
      name: "Schülergruppe",
      condition: "showStudentgroup",
    });
    expect(result).toContainEqual({
      key: "subject",
      name: "Fach",
      condition: "showSubject",
    });
    expect(result).not.toContainEqual({
      key: "room",
      name: "Raum",
      condition: "showRoom",
    });
    expect(result).toContainEqual({
      key: "teacher",
      name: "Lehrer",
      condition: "showTeacher",
    });
    expect(result).not.toContainEqual({
      key: "type",
      name: "Art",
      condition: "showInfo",
    });
    expect(result).toContainEqual({
      key: "info",
      name: "Info",
      condition: "showSubstText",
    });
  });
});
