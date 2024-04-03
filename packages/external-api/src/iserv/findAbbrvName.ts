import { z } from "zod";

import { MakeRequest } from "./auth";

const schema = z.array(
  z.object({
    label: z.string(),
    text: z.string(),
    value: z.string(),
    source: z.string(),
    avatar: z.string().nullable(),
    avatarHtml: z.string(),
    extra: z.string(),
    certainty: z.number(),
    fuzzy: z.boolean(),
  }),
);

export const findAbbrvName = async (
  makeRequest: MakeRequest,
  abbrv: string,
) => {
  const params = new URLSearchParams();
  params.set("type", "mail,list");
  params.set("query", abbrv);
  const response = await makeRequest(
    `https://igslilienthal.de/iserv/core/autocomplete/api?${params.toString()}`,
    {},
  );

  const json = await response.json();

  const data = schema.parse(json);
  const match = data.find((entry) =>
    entry.extra
      .split(",")
      .map((s) => s.trim())
      .includes(abbrv),
  );

  if (!match) {
    return null;
  }

  const regex =
    /^([a-zA-ZäöüÄÖÜ\- ]+) <(([a-z\-]+\.)+[a-z\-]+@igslilienthal\.de)>$/;
  const matchResult = regex.exec(match.text);
  if (!matchResult) {
    throw new Error(`Could not parse name and email from "${match.text}"`);
  }

  const [, name, email] = matchResult;

  if (!name || !email) {
    throw new Error(`Could not parse name or email from "${match.text}"`);
  }

  return { name, email };
};
