import type { CookieJar } from "tough-cookie";
import { format, parse } from "date-fns";
import { z } from "zod";

import { fetchWithCookieJar } from "../../fetch-with-cookies";
import snapshotData from "./timetable.snapshot.json";

const convertNumberToDate = (num: number) => {
  const str = num.toString();
  return parse(str, "yyyyMMdd", new Date());
};

const convertNumberToTimeOfDay = (num: number) => {
  const str = num.toString().padStart(4, "0");
  const date = parse(str, "HHmm", new Date());
  const minutes = date.getHours() * 60 + date.getMinutes();
  if (isNaN(minutes)) {
    throw new Error(`Invalid time number ${num}`);
  }
  return minutes;
};

const typeSchema = z
  .literal(1)
  .or(z.literal(2))
  .or(z.literal(3))
  .or(z.literal(4));

const dataSchema = z.object({
  elementPeriods: z.record(
    z.string(),
    z.array(
      z.object({
        date: z.number().transform(convertNumberToDate),
        startTime: z.number().transform(convertNumberToTimeOfDay),
        endTime: z.number().transform(convertNumberToTimeOfDay),
        periodText: z.string(),
        hasPeriodText: z.boolean(),
        periodInfo: z.string(),
        hasInfo: z.boolean(),
        cellState: z.enum(["STANDARD", "SUBSTITUTION", "ADDITIONAL"]),
        elements: z.array(
          z.object({
            type: typeSchema,
            id: z.number(),
            orgId: z.number(),
            missing: z.boolean(),
            state: z.enum(["REGULAR", "SUBSTITUTED", "ABSENT"]),
          }),
        ),
      }),
    ),
  ),
  elements: z.array(
    z.discriminatedUnion("type", [
      z.object({
        type: z.literal(1),
        id: z.number(),
        name: z.string(),
        longName: z.string(),
      }),
      z.object({
        type: z.literal(2),
        id: z.number(),
        name: z.string(),
      }),
      z.object({
        type: z.literal(3),
        id: z.number(),
        name: z.string(),
        longName: z.string(),
      }),
      z.object({
        type: z.literal(4),
        id: z.number(),
        name: z.string(),
        longName: z.string(),
      }),
    ]),
  ),
});

const schema = z.object({
  data: z.object({
    result: z.object({
      data: dataSchema,
    }),
  }),
});

export type KadmosTimetableResponse = z.infer<
  typeof schema
>["data"]["result"]["data"];

export const getTimetable = async (
  kadmosClassId: number,
  date: Date,
  cookies: CookieJar | null,
): Promise<KadmosTimetableResponse> => {
  if (!cookies) {
    return dataSchema.parse(snapshotData);
  }

  const params = new URLSearchParams();
  params.append("elementType", "1");
  params.append("elementId", kadmosClassId.toString());
  params.append("date", format(date, "yyyy-MM-dd"));
  params.append("formatId", "0");
  params.append("filter.departmentId", "-1");

  const response = await fetchWithCookieJar(
    `https://kadmos.webuntis.com/WebUntis/api/public/timetable/weekly/data?${params.toString()}`,
    {},
    cookies,
  );

  const json = await response.json();

  const parsed = schema.parse(json);

  return parsed.data.result.data;
};
