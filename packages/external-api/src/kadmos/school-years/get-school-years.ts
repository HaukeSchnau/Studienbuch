import { parseSimpleDate } from "@stu/lib";
import z from "zod";
import { fetchWithCookieJar } from "../../fetch-with-cookies";
import type { AuthContext } from "../auth/login";

const schema = z.array(
  z.object({
    dateRange: z.object({
      start: z.string().transform(parseSimpleDate),
      end: z.string().transform(parseSimpleDate),
    }),
    id: z.number(),
    name: z.string(),
  }),
);

type SchoolYears = z.infer<typeof schema>;

export const getSchoolYears = async (authContext: AuthContext): Promise<SchoolYears> => {
  const response = await fetchWithCookieJar(
    "https://kadmos.webuntis.com/WebUntis/api/rest/view/v1/schoolyears",
    {
      headers: {
        Authorization: `Bearer ${authContext.bearerToken}`,
      },
    },
    authContext.jar,
  );

  const data = await response.json();
  return schema.parse(data);
};
