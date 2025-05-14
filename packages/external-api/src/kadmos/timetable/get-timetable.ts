import type { CookieJar } from "tough-cookie";
import { z } from "zod";

import { fetchWithCookieJar } from "../../fetch-with-cookies";
import {
  formatSimpleDate,
  parseSimpleDate,
  parseSimpleTimeOfDay,
} from "@stu/lib";
import type { SimpleDate } from "@stu/lib";

const parseDurationComponent = (
  duration: string,
): {
  date: SimpleDate;
  time: number;
} => {
  const [date, time] = duration.split("T");
  if (!date || !time) throw new Error(`Invalid duration: ${duration}`);
  return {
    date: parseSimpleDate(date),
    time: parseSimpleTimeOfDay(time),
  };
};

const parseDuration = (duration: { start: string; end: string }) => {
  return {
    start: parseDurationComponent(duration.start),
    end: parseDurationComponent(duration.end),
  };
};

const PositionSchema = z.object({
  current: z
    .object({
      type: z.enum(["SUBJECT", "TEACHER", "ROOM", "CLASS", "INFO"]),
      status: z.enum(["REGULAR", "ADDED"]),
      shortName: z.string(),
      longName: z.string(),
      displayName: z.string(),
    })
    .nullable(),
  removed: z
    .object({
      type: z.enum(["TEACHER", "ROOM", "CLASS"]),
      status: z.enum(["REMOVED"]),
      shortName: z.string(),
      longName: z.string(),
      displayName: z.string(),
    })
    .nullable(),
});

const PositionValueSchema = z
  .array(PositionSchema)
  .or(PositionSchema)
  .nullable();

const v2Schema = z.object({
  errors: z.tuple([]),
  days: z.array(
    z.object({
      date: z.string().transform(parseSimpleDate),
      resourceType: z.enum(["CLASS"]),
      resource: z.object({
        id: z.number(),
        shortName: z.string(),
        longName: z.string(),
        displayName: z.string(),
      }),
      status: z.enum(["REGULAR", "NO_DATA"]),
      dayEntries: z.tuple([]),
      gridEntries: z.array(
        z.object({
          ids: z.array(z.number()),
          duration: z
            .object({
              start: z.string(),
              end: z.string(),
            })
            .transform(parseDuration),
          type: z.enum(["NORMAL_TEACHING_PERIOD", "EVENT", "EXAM"]),
          status: z.enum(["REGULAR", "CHANGED", "ADDITIONAL"]),
          statusDetail: z.null(),
          position1: PositionValueSchema,
          position2: PositionValueSchema,
          position3: PositionValueSchema,
          position4: PositionValueSchema,
          position5: PositionValueSchema,
        }),
      ),
    }),
  ),
});

export type KadmosTimetableV2Response = z.infer<typeof v2Schema>;

export const getTimetableV2 = async (
  start: SimpleDate,
  end: SimpleDate,
  kadmosClassId: number,
  cookies: CookieJar,
  bearerToken: string,
): Promise<KadmosTimetableV2Response> => {
  const params = new URLSearchParams();
  params.append("start", formatSimpleDate(start));
  params.append("end", formatSimpleDate(end));
  params.append("format", "0");
  params.append("resourceType", "CLASS");
  params.append("resources", kadmosClassId.toString());
  params.append("periodTypes", "");
  params.append("timetableType", "STANDARD");

  const response = await fetchWithCookieJar(
    `https://kadmos.webuntis.com/WebUntis/api/rest/view/v1/timetable/entries?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${bearerToken}`,
      },
    },
    cookies,
  );

  const json = await response.json();
  const parsed = v2Schema.parse(json);

  return parsed;
};
