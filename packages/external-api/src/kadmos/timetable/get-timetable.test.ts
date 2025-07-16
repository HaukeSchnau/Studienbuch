import { describe, test } from "vitest";

import { getBearerToken, login } from "../auth/login";
import { getTimetableV2 } from "./get-timetable";
import { parseSimpleDate } from "@stu/lib";

describe("Get timetable from Kadmos", () => {
  test("Get timetable from Kadmos", async () => {
    const jar = await login("IGS Lilienthal", "hauke.studienbuch", "App#Hauke2024");
    const token = await getBearerToken(jar);

    const timetable = await getTimetableV2(
      parseSimpleDate("2024-08-28"),
      parseSimpleDate("2024-08-28"),
      348,
      jar,
      token,
    );

    console.log(timetable);
  });
});
