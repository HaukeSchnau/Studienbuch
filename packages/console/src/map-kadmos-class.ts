import { TZDate } from "@date-fns/tz";
import type { KadmosClassV2Response, KadmosTimetableV2Response } from "@stu/external-api";
import type { SubjectId } from "@stu/lib";
import { convertCurrentYearToStartYear, guessSubject } from "@stu/lib";
import { differenceInMinutes } from "date-fns";
import { logger } from "./logger";

const isTeachersAbbrvString = (longName: string) => {
  const regex = /^([A-ZÄÖÜ]{3})(\/[A-ZÄÖÜ]{3})*$/i;
  return regex.test(longName);
};

const extractYearNum = (name: string) => {
  const yearStr = name.split(".")[0];
  if (!yearStr) throw new Error(`couldnt extract year num from ${name}`);

  return Number.parseInt(yearStr);
};

const mapKadmosClassTeacher = (
  teacher:
    | KadmosClassV2Response["classes"][number]["classTeacher1"]
    | KadmosClassV2Response["classes"][number]["classTeacher2"]
    | null,
) => {
  if (!teacher) return null;
  return {
    kadmosId: teacher.id,
    name: teacher.longName,
    abbrv: teacher.shortName,
  };
};

export interface ClassV2 {
  kadmosId: number;
  startYear: number;
  yearName: string | null;
  identifierInYear: string;
  teachers: {
    kadmosId: number;
    name: string;
    abbrv: string;
  }[];
}

export const mapKadmosClassV2 = ({
  class: { id, shortName, longName },
  classTeacher1,
  classTeacher2,
}: KadmosClassV2Response["classes"][number]): ClassV2 => ({
  kadmosId: id,
  startYear: convertCurrentYearToStartYear(extractYearNum(shortName)),
  yearName: isTeachersAbbrvString(longName) ? null : longName,
  identifierInYear: shortName.split(".")[1] ?? "",
  teachers: [mapKadmosClassTeacher(classTeacher1), mapKadmosClassTeacher(classTeacher2)].filter((x) => x !== null),
});

export interface ProtoTimetableEntry {
  course: {
    // kadmosId: number;
    name: string;
    // longName: string;
    subject: SubjectId;
  };
  classes: {
    identifierInYear: string;
    startYear: number;
    change: "REMOVED" | null;
  }[];
  teachers: {
    name: string;
    abbrv: string;
    change:
      | {
          type: "REMOVED";
        }
      | {
          type: "REPLACED";
          name: string;
          abbrv: string;
        }
      | null;
  }[];
  roomNumbers: {
    name: string;
    change:
      | {
          type: "REMOVED";
        }
      | {
          type: "REPLACED";
          name: string;
        }
      | null;
  }[];
  start: Date;
  duration: number;
}

const normalizeCourseName = (name: string) => {
  return name.replaceAll("- ", "-");
};

export const mapKadmosTimetableEntry = (
  entry: KadmosTimetableV2Response["days"][number]["gridEntries"][number],
  baseClass: ClassV2,
): ProtoTimetableEntry | null => {
  if (entry.type !== "NORMAL_TEACHING_PERIOD") {
    logger.warn(`Skipping non-normal teaching period: ${JSON.stringify(entry)}`);
    return null;
  }

  const startDate = new TZDate(
    entry.duration.start.date.year,
    entry.duration.start.date.month - 1,
    entry.duration.start.date.day,
    0,
    entry.duration.start.time,
    "Europe/Berlin", // todo: dynamic timezone
  );
  const endDate = new TZDate(
    entry.duration.end.date.year,
    entry.duration.end.date.month - 1,
    entry.duration.end.date.day,
    0,
    entry.duration.end.time,
    "Europe/Berlin", // todo: dynamic timezone
  );
  const duration = differenceInMinutes(endDate, startDate);

  const positions = [entry.position1, entry.position2, entry.position3, entry.position4, entry.position5]
    .filter((x) => x !== null)
    .flat();

  const courseArr = positions
    .map((pos) => {
      if (pos.current?.type !== "SUBJECT") return null;

      if (pos.removed) throw new Error(`Subject cannot be removed: ${JSON.stringify(pos)}`);

      return {
        shortName: pos.current.shortName,
        longName: pos.current.longName,
      };
    })
    .filter((x) => x !== null);
  if (courseArr.length > 1) {
    throw new Error(`Multiple subjects: ${JSON.stringify(courseArr)} ${JSON.stringify(baseClass)}`);
  }
  const [course] = courseArr;
  if (!course) {
    logger.warn(`No subject found in ${JSON.stringify(entry)}`);
    return null;
  }

  const normalizedCourseName = normalizeCourseName(course.shortName);

  const subject = guessSubject(normalizedCourseName);
  if (!subject) {
    logger.warn(`Unknown subject: "${course.shortName}". Skipping this course.`);
    return null;
  }

  const ret: ProtoTimetableEntry = {
    course: {
      subject,
      name: normalizedCourseName,
    },
    classes: [
      {
        ...baseClass,
        change: null,
      },
      ...positions
        .map((pos): ProtoTimetableEntry["classes"][number] | null => {
          if (pos.current?.type !== "CLASS" && pos.removed?.type !== "CLASS") return null;

          if ((pos.current && pos.removed) || (!pos.current && !pos.removed))
            throw new Error(
              `Invalid class: ${startDate.toISOString()} ${JSON.stringify(pos)} ${JSON.stringify(baseClass)}`,
            );

          const val = pos.current ?? pos.removed;
          if (!val) throw new Error("logic error: shouldnt happen");

          return {
            startYear: convertCurrentYearToStartYear(extractYearNum(val.shortName)),
            identifierInYear: val.shortName.split(".")[1] ?? "",
            change: pos.removed ? "REMOVED" : null,
          };
        })
        .filter((x) => x !== null),
    ],
    start: startDate,
    duration: duration,
    roomNumbers: positions
      .map((pos) => {
        if (pos.current?.type !== "ROOM" && pos.removed?.type !== "ROOM") return null;
        if (pos.removed) {
          if (!pos.current) {
            return {
              name: pos.removed.shortName,
              change: {
                type: "REMOVED" as const,
              },
            };
          }

          return {
            name: pos.removed.shortName,
            change: {
              type: "REPLACED" as const,
              name: pos.current.shortName,
            },
          };
        }

        if (!pos.current) {
          throw new Error(
            `Room needs a value: ${startDate.toISOString()} ${JSON.stringify(pos)} ${JSON.stringify(baseClass)}`,
          );
        }

        return {
          name: pos.current.shortName,
          change: null,
        };
      })
      .filter((x) => x !== null),
    teachers: positions
      .map((pos) => {
        if (pos.current?.type !== "TEACHER" && pos.removed?.type !== "TEACHER") return null;

        if (pos.removed) {
          if (!pos.current) {
            return {
              name: pos.removed.longName,
              abbrv: pos.removed.shortName,
              change: {
                type: "REMOVED" as const,
              },
            };
          }

          return {
            name: pos.removed.longName,
            abbrv: pos.removed.shortName,
            change: {
              type: "REPLACED" as const,
              name: pos.current.longName,
              abbrv: pos.current.shortName,
            },
          };
        }

        if (!pos.current) {
          throw new Error(
            `Teacher needs a value: ${startDate.toISOString()} ${JSON.stringify(pos)} ${JSON.stringify(baseClass)}`,
          );
        }

        return {
          name: pos.current.longName,
          abbrv: pos.current.shortName,
          change: null,
        };
      })
      .filter((x) => x !== null),
  };

  return ret;
};
