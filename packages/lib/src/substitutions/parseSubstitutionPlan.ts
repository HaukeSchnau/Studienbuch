import dayjs, { type Dayjs } from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import utc from "dayjs/plugin/utc";
import pdfTableExtractor, { type PageTable } from "pdf-table-extractor";

import { compareMaps } from "../equality";

dayjs.extend(utc);
dayjs.extend(customParseFormat);

function getMap(rows: string[][]) {
  const map = new Map<string, number>();
  if (!rows[0]) return map;
  rows[0].forEach((e, i) => map.set(e, i));
  return map;
}

function filterRows(table?: PageTable) {
  if (!table) return [];
  const headVals = [
    "stunde",
    "klasse(n)",
    "fach",
    "raum",
    "(fach)",
    "vertr. von",
    "(le.) nach",
    "vertretungs-text",
    "art",
  ];
  const startIndex = table.tables.findIndex((row) =>
    row.find((cell) => headVals.includes(cell.trim().toLowerCase())),
  );
  const rowsBeforeCorrection = table.tables.slice(startIndex);
  const rows: string[][] = [];
  for (const row of rowsBeforeCorrection) {
    const isEmpty = row.every((e) => !e.trim());
    if (isEmpty) continue;

    const isDouble = !!row.find((e) => e.includes("\n"));
    if (isDouble) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      rows.push(row.map((e) => e.split("\n")[0]!));
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      rows.push(row.map((e) => e.split("\n")[1]!));
    } else {
      rows.push(row);
    }
  }
  return rows;
}

export const parseTable = function (file: string) {
  return new Promise<ProtoSubstitution[]>((resolve, reject) => {
    pdfTableExtractor(
      file,
      (res) => {
        const entries: ProtoSubstitution[] = [];
        const firstRow = res.pageTables[0]?.tables[0];
        const dateStr = firstRow?.[0]?.split(" ")[2];

        let date = dayjs.utc(dateStr, "DD.MM.").startOf("day");
        if (!date.isValid()) {
          date = dayjs.utc(dateStr, "DD.M.");
        }
        if (!date.isValid()) {
          date = dayjs.utc(dateStr, "D.M.");
        }
        if (!date.isValid()) {
          date = dayjs.utc(dateStr, "D.MM.");
        }

        let counter = 0;

        res.pageTables.forEach((table, tableI) => {
          const rows = filterRows(table);
          const map = getMap(rows);
          const prevMap = getMap(filterRows(res.pageTables[tableI - 1]));
          if (!compareMaps(map, prevMap)) {
            counter = 0;
          }

          rows.slice(1).forEach((row) => {
            const existingEntry = entries[counter];
            const isNew = !existingEntry;
            const parsedEntry = parseEntry(row, map, date);

            if (!parsedEntry) return;

            if (isNew) {
              entries.push(parsedEntry);
            } else {
              existingEntry.date = existingEntry.date || date;
              existingEntry.lessonStart =
                existingEntry.lessonStart !== -1
                  ? existingEntry.lessonStart
                  : parsedEntry.lessonStart;
              existingEntry.lessonEnd =
                existingEntry.lessonEnd !== -1
                  ? existingEntry.lessonEnd
                  : parsedEntry.lessonEnd;
              existingEntry.classes =
                existingEntry.classes || parsedEntry.classes;
              existingEntry.subject =
                existingEntry.subject || parsedEntry.subject;
              existingEntry.readableSubject =
                existingEntry.readableSubject || parsedEntry.readableSubject;
              existingEntry.room = existingEntry.room || parsedEntry.room;
            }
            counter++;
          });
        });
        resolve(entries);
      },
      (err) => reject(err),
    );
  });
};

type ProtoSubstitution = {
  date: Dayjs;
  lessonStart: number;
  lessonEnd: number;
  classes?: string[];
  subject?: string;
  readableSubject?: string;
  room?: string;
  type?: string;
};

function parseEntry(
  row: string[],
  columnMap: Map<string, number>,
  date: Dayjs,
): ProtoSubstitution | null {
  const getAttr = (name: string) => {
    const index = columnMap.get(name);
    if (index === null || index === undefined)
      throw new Error(`No ${name} column on VPlan!`);
    return row[index];
  };

  const stunde = getAttr("Stunde");
  let lessonStart = -1;
  let lessonEnd = -1;
  if (stunde) {
    if (stunde.includes("-")) {
      const split = stunde.split("-");
      lessonStart = parseInt(split[0] || "-1");
      lessonEnd = parseInt(split[1] || "-1");
    } else if (stunde.includes("/")) {
      const split = stunde.split("/");
      lessonStart = parseInt(split[0] || "-1");
      lessonEnd = parseInt(split[1] || "-1");
    } else {
      lessonStart = parseInt(stunde);
      lessonEnd = parseInt(stunde);
    }
    lessonStart -= 1;
    lessonEnd -= 1;
  }

  const classesStr = getAttr("Klasse(n)");
  const classes = classesStr
    ? trim(trim(classesStr, "("), ")")
        .trim()
        .split(",")
        .map((e) => trim(e, ".").trim())
        .filter((e) => e)
    : undefined;

  const subject = getAttr("(Fach)")?.toLowerCase();

  if (isNaN(lessonStart) || isNaN(lessonEnd)) {
    console.log("Failed to parse row: " + JSON.stringify(row));
    return null;
  }
  let room = getAttr("Raum");
  if (room === "---") room = undefined;

  const type = getAttr("Art");

  return {
    date,
    lessonStart,
    lessonEnd,
    classes,
    subject,
    readableSubject: getAttr("(Fach)")?.replaceAll("- ", "-"),
    room,
    type,
  };
}
function trim(str: string, ch: string) {
  let start = 0,
    end = str.length;

  while (start < end && str[start] === ch) ++start;

  while (end > start && str[end - 1] === ch) --end;

  return start > 0 || end < str.length ? str.substring(start, end) : str;
}
