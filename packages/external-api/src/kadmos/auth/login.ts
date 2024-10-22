import { CookieJar } from "tough-cookie";
import { z } from "zod";

import { fetchWithCookieJar } from "../../fetch-with-cookies";

export const login = async (
  school: string,
  username: string,
  password: string,
) => {
  const jar = new CookieJar();

  let response = await fetchWithCookieJar(
    `https://kadmos.webuntis.com/WebUntis/?school=${encodeURIComponent(school)}`,
    { method: "GET" },
    jar,
  );

  response = await fetchWithCookieJar(
    "https://kadmos.webuntis.com/WebUntis/j_spring_security_check",
    {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        accept: "application/json",
      },
      body: new URLSearchParams({
        school: school,
        j_username: username,
        j_password: password,
        token: "",
      }),
    },
    jar,
  );

  const successResponseSchema = z.object({
    state: z.literal("SUCCESS"),
  });

  successResponseSchema.parse(await response.json());

  return jar;
};
