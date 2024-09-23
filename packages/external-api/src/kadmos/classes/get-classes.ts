import type { CookieJar } from "tough-cookie";
import { z } from "zod";

import { fetchWithCookieJar } from "../../fetch-with-cookies";

const responseSchema = z.object({
  data: z.object({
    elements: z.array(
      z.object({
        id: z.number(),
        name: z.string(),
        longName: z.string(),
      }),
    ),
  }),
});

export type KadmosClassResponse = z.infer<
  typeof responseSchema
>["data"]["elements"];

export const getClasses = async (
  jar: CookieJar,
): Promise<KadmosClassResponse> => {
  const params = new URLSearchParams();
  params.append("type", "1");
  params.append("isMyTimetableSelected", "false");

  const response = await fetchWithCookieJar(
    `https://kadmos.webuntis.com/WebUntis/api/public/timetable/weekly/pageconfig?${params.toString()}`,
    {},
    jar,
  );

  const json = await response.json();

  const parsed = responseSchema.parse(json);

  return parsed.data.elements;
};
