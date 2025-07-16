import type { SimpleDate } from "@stu/lib";
import { z } from "zod";
import { fetchWithCookieJar } from "../../fetch-with-cookies";
import type { AuthContext } from "../auth/login";

const schema = z.object({
  resourceType: z.literal("TEACHER"),
  preSelected: z.unknown(),
  buildings: z.array(z.unknown()),
  departments: z.array(
    z.object({
      id: z.number(),
      shortName: z.string(),
      longName: z.string(),
      displayName: z.string(),
    }),
  ),
  roomGroups: z.array(z.unknown()),
  resourceTypes: z.array(z.unknown()),
  assignmentGroups: z.array(z.unknown()),
  classes: z.array(z.unknown()),
  resources: z.array(z.unknown()),
  rooms: z.array(z.unknown()),
  subjects: z.array(z.unknown()),
  students: z.array(z.unknown()),
  teachers: z.array(
    z.object({
      teacher: z.object({
        id: z.number(),
        shortName: z.string(),
        longName: z.string(),
        displayName: z.string(),
      }),
      departments: z.array(z.unknown()),
    }),
  ),
});

export type KadmosTeacherV2Response = z.infer<typeof schema>;

export const getTeachersV2 = async (
  start: SimpleDate,
  end: SimpleDate,
  schoolYearId: number,
  authContext: AuthContext,
): Promise<KadmosTeacherV2Response> => {
  const params = new URLSearchParams();
  params.append("resourceType", "TEACHER");
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
        Authorization: `Bearer ${authContext.bearerToken}`,
        "x-webuntis-api-school-year-id": schoolYearId.toString(),
      },
    },
    authContext.jar,
  );

  return schema.parse(await response.json());
};
