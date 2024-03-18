import type { KadmosFormat } from "@schnau/external-api";

interface Column {
  key: string;
  name: string;
  condition: keyof KadmosFormat;
}

const columns = [
  {
    key: "hour",
    name: "Stunde",
    condition: "showHour",
  },
  {
    key: "time",
    name: "Zeit",
    condition: "showTime",
  },
  {
    key: "class",
    name: "Klassen",
    condition: "showClass",
  },
  {
    key: "studentGroup",
    name: "Schülergruppe",
    condition: "showStudentgroup",
  },
  {
    key: "subject",
    name: "Fach",
    condition: "showSubject",
  },
  {
    key: "room",
    name: "Raum",
    condition: "showRoom",
  },
  {
    key: "teacher",
    name: "Lehrer",
    condition: "showTeacher",
  },
  {
    key: "type",
    name: "Art",
    condition: "showInfo",
  },
  {
    key: "info",
    name: "Info",
    condition: "showSubstText",
  },
] as const satisfies Column[];

type ColumnConfiguration = (typeof columns)[number][];
type ColumnKey = (typeof columns)[number]["key"];
interface Cell {
  data: string | undefined;
  rowSpan: number;
}

export const convertKadmosRowsToSubstitutionsTable = (
  rows: { data: string[] }[],
  columns: ColumnConfiguration,
) => {
  return rows.map(({ data }) => {
    const result: Partial<Record<ColumnKey, Cell>> = {};

    columns.forEach((column, i) => {
      result[column.key] = {
        data: data[i],
        rowSpan: 1,
      };
    });

    return result;
  });
};

export const getSubstituionTableColumns = (
  format: KadmosFormat,
): ColumnConfiguration => {
  return columns.filter((column) => format[column.condition]);
};
