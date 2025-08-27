import { test } from "vitest";

import { getBearerToken, login } from "../auth/login";
import { getSchoolYears } from "./get-school-years";

test("Get school years from Kadmos", async () => {
  const jar = await login("IGS Lilienthal", "hauke.studienbuch", "App#Hauke2024");
  const bearerToken = await getBearerToken(jar);

  const schoolYears = await getSchoolYears({ jar, bearerToken });
  console.dir(schoolYears, { depth: null });
});
