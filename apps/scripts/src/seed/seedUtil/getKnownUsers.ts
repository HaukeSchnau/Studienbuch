import fs from "fs/promises";
import Papa from "papaparse";
import { z } from "zod";

import { fileExists } from "@schnau/common/src/fileExists";

import { getFilePath } from "../../getFilePath";

const knownUserSchema = z.object({
  abbrv: z.string(),
  name: z.string().min(1),
  title: z.string().min(1),
});

export type KnownUser = z.infer<typeof knownUserSchema>;

export const getKnownUsers = async (): Promise<KnownUser[]> => {
  const path = getFilePath("known-users.csv");
  if (!(await fileExists(path))) {
    console.warn("No known-users.csv found");
    return [];
  }

  const csv = await fs.readFile(path, "utf8");
  const { data: rows } = Papa.parse(csv, { header: true });

  return rows
    .map((row) => knownUserSchema.safeParse(row))
    .filter((user) => user.success && user.data.abbrv !== user.data.name)
    .map((user) => user.success && user.data)
    .filter(Boolean);
};
