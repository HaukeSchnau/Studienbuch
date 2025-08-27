import { parseSimpleDate } from "@stu/lib";
import { describe, test } from "vitest";
import { getBearerToken, login } from "../auth/login";
import { getTimetableV2 } from "./get-timetable";

describe("Get timetable from Kadmos", () => {
  test("Get timetable from Kadmos", async () => {
    const jar = await login("IGS Lilienthal", "hauke.studienbuch", "App#Hauke2024");
    const bearerToken = await getBearerToken(jar);

    const timetable = await getTimetableV2(
      {
        start: parseSimpleDate("2024-08-28"),
        end: parseSimpleDate("2024-08-28"),
        kadmosClassId: 348,
        schoolYearId: 6,
      },
      { jar, bearerToken },
    );

    console.log(timetable);
  });
});
