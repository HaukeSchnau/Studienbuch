import { Cookie, CookieJar } from "tough-cookie";

export const loginIserv = async (username: string, password: string) => {
  const jar = new CookieJar();

  const makeRequest = async (
    url: string,
    options: RequestInit,
  ): Promise<Response> => {
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

    const redirectUrl = response.headers.get("location");

    if (redirectUrl) {
      return makeRequest(
        redirectUrl.startsWith("http")
          ? redirectUrl
          : `https://igslilienthal.de${redirectUrl}`,
        {
          headers: {
            accept:
              "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
            "accept-language": "en-GB,en;q=0.9",
            "cache-control": "no-cache",
            pragma: "no-cache",
            "sec-ch-ua": '"Chromium";v="123", "Not:A-Brand";v="8"',
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": '"macOS"',
            "sec-fetch-dest": "document",
            "sec-fetch-mode": "navigate",
            "sec-fetch-site": "same-origin",
            "sec-fetch-user": "?1",
            "upgrade-insecure-requests": "1",
            cookie: "IServAuthSession=cloi2rkkqrad73d13o7qltkikj",
          },
          referrerPolicy: "no-referrer",
          body: null,
          method: "GET",
        },
      );
    }

    return response;
  };

  let response = await makeRequest("https://igslilienthal.de/iserv/", {
    headers: {
      accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
      "accept-language": "en-GB,en;q=0.9",
      "cache-control": "no-cache",
      pragma: "no-cache",
      "sec-ch-ua": '"Chromium";v="123", "Not:A-Brand";v="8"',
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": '"macOS"',
      "sec-fetch-dest": "document",
      "sec-fetch-mode": "navigate",
      "sec-fetch-site": "none",
      "sec-fetch-user": "?1",
      "upgrade-insecure-requests": "1",
    },
    referrerPolicy: "strict-origin-when-cross-origin",
    body: null,
    method: "GET",
  });

  response = await makeRequest(response.url, {
    headers: {
      accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
      "accept-language": "en-GB,en;q=0.9",
      "cache-control": "no-cache",
      "content-type": "application/x-www-form-urlencoded",
      pragma: "no-cache",
      "sec-ch-ua": '"Chromium";v="123", "Not:A-Brand";v="8"',
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": '"macOS"',
      "sec-fetch-dest": "document",
      "sec-fetch-mode": "navigate",
      "sec-fetch-site": "same-origin",
      "sec-fetch-user": "?1",
      "upgrade-insecure-requests": "1",
    },
    referrerPolicy: "no-referrer",
    body: "_username=hauke.schnau&_password=yXPTd26D5",
    method: "POST",
  });

  if (response.url !== "https://igslilienthal.de/iserv/") {
    throw new Error("Could not login");
  }

  return makeRequest;
};
