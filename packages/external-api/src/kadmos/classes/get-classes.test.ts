import { test } from "vitest";

import { getBearerToken, login } from "../auth/login";
import { getClassesV2 } from "./get-classes";

test("Get classes from Kadmos", async () => {
  const jar = await login("IGS Lilienthal", "hauke.studienbuch", "App#Hauke2024");
  const bearerToken = await getBearerToken(jar);

  const classes = await getClassesV2(
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
  console.dir(classes.classes, { depth: null });
});
