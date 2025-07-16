import type { CookieJar } from "tough-cookie";
import { z } from "zod";

import { fetchWithCookieJar } from "../../fetch-with-cookies";
import type { SimpleDate } from "@stu/lib";

const v2Schema = z.object({
  departments: z.array(
    z.object({
      id: z.number(),
      shortName: z.string(),
      longName: z.string(),
      displayName: z.string(),
    }),
  ),
  classes: z.array(
    z.object({
      class: z.object({
        id: z.number(),
        shortName: z.string(),
        longName: z.string(),
        displayName: z.string(),
      }),
      classTeacher1: z
        .object({
          id: z.number(),
          shortName: z.string(),
          longName: z.string(),
          displayName: z.string(),
        })
        .nullable(),
      classTeacher2: z
        .object({
          id: z.number(),
          shortName: z.string(),
          longName: z.string(),
          displayName: z.string(),
        })
        .nullable(),
      department: z.object({
        id: z.number(),
        shortName: z.string(),
        longName: z.string(),
        displayName: z.string(),
      }),
    }),
  ),
});

export type KadmosClassV2Response = z.infer<typeof v2Schema>;

export const getClassesV2 = async (
  start: SimpleDate,
  end: SimpleDate,
  jar: CookieJar,
  bearerToken: string,
): Promise<KadmosClassV2Response> => {
  const params = new URLSearchParams();
  params.append("resourceType", "CLASS");
  params.append("timetableType", "STANDARD");
  params.append(
    "start",
    `${start.year}-${start.month.toString().padStart(2, "0")}-${start.day.toString().padStart(2, "0")}`,
  );
  params.append("end", `${end.year}-${end.month.toString().padStart(2, "0")}-${end.day.toString().padStart(2, "0")}`);

  const response = await fetchWithCookieJar(
    `https://kadmos.webuntis.com/WebUntis/api/rest/view/v1/timetable/filter?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${bearerToken}`,
      },
    },
    jar,
  );

  return v2Schema.parse(await response.json());
};
