import { headers } from "next/headers";

export const getCurrentUrl = () => {
  const urlStr = headers().get("x-url");
  if (!urlStr)
    throw new Error(
      "x-url header is missing. Please add the Next.js middleware.",
    );

  return new URL(urlStr);
};
