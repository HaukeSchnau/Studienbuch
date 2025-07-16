import { test } from "vitest";

import { getBearerToken, login } from "../auth/login";
import { getTeachersV2 } from "./get-teachers";

test("Get teachers from Kadmos", async () => {
  const jar = await login("IGS Lilienthal", "hauke.studienbuch", "App#Hauke2024");
  const bearerToken = await getBearerToken(jar);

  const teachers = await getTeachersV2(
    {
      year: 2025,
      month: 7,
      day: 14,
    },
    {
      year: 2025,
      month: 7,
      day: 18,
    },
    6,
    { jar, bearerToken },
  );
  console.dir(teachers, { depth: null });
});
