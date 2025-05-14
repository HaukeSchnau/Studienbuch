import { test } from "vitest";

import { login } from "../auth/login";

test("Get classes from Kadmos", async () => {
  const jar = await login(
    "IGS Lilienthal",
    "hauke.studienbuch",
    "App#Hauke2024",
  );

  // await getClasses(jar);
});
