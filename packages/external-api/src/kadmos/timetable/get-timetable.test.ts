import { writeFile } from "fs/promises";
import path from "path";
import { describe, test, vi } from "vitest";

import { login } from "../auth/login";
import { getTimetable } from "./get-timetable";

describe("Get timetable from Kadmos", () => {
  test("Get timetable from Kadmos", async () => {
    const jar = await login(
      "IGS Lilienthal",
      "hauke.studienbuch",
      "App#Hauke2024",
    );
    const response = await getTimetable(348, new Date(), jar);

    await writeFile(
      path.resolve(__dirname, "timetable.snapshot.json"),
      JSON.stringify(response, null, 2),
    );
  });
});
