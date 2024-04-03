import { z } from "zod";

import { loginIserv } from "./auth";

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

export const findAbbrvName = async (abbrv: string) => {
  const makeRequest = await loginIserv("hauke.schnau", "yXPTd26D5");

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

  return match;
};
