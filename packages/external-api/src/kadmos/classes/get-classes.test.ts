import { test } from "vitest";

import { getBearerToken, login } from "../auth/login";
import { getClassesV2 } from "./get-classes";

test("Get classes from Kadmos", async () => {
  const jar = await login(
    "IGS Lilienthal",
    "hauke.studienbuch",
    "App#Hauke2024",
  );

  const token = await getBearerToken(jar);

  const classes = await getClassesV2(
    {
      year: 2024,
      month: 8,
      day: 28,
    },
    {
      year: 2024,
      month: 8,
      day: 28,
    },
    jar,
    token,
  );
  console.log(classes);
});
