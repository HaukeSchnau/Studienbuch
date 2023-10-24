import type { ZodSchema } from "zod";

type Cookies = Record<string, string>;

const parseCookie = (str: string) =>
  str
    .split(";")
    .map((v) => v.split("="))
    .reduce((acc, v) => {
      const [key, value] = v;
      if (key && value) {
        acc[decodeURIComponent(key.trim())] = decodeURIComponent(value.trim());
      }
      return acc;
    }, {} as Cookies);

export const getCookies = <TCookies>(
  headers: Headers,
  schema: ZodSchema<TCookies>,
) => {
  const cookieString = headers.get("cookie");
  const cookieObj = cookieString ? parseCookie(cookieString) : {};
  const parsed = schema.safeParse(cookieObj);
  if (parsed.success) {
    return parsed.data;
  }
  return null;
};
