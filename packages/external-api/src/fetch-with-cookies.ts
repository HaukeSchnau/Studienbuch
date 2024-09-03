import type { CookieJar } from "tough-cookie";
import { Cookie } from "tough-cookie";

export const fetchWithCookieJar = async (
  url: string,
  options: RequestInit,
  jar: CookieJar,
) => {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      cookie: jar.getCookieStringSync(url),
    },
    redirect: "manual",
  });

  response.headers.forEach((cookieStr, key) => {
    if (key === "set-cookie") {
      const cookie = Cookie.parse(cookieStr);
      if (!cookie) throw new Error("Could not parse cookie: " + cookieStr);

      jar.setCookieSync(cookie, url);
    }
  });

  return response;
};
