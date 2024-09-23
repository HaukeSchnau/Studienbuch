import { writeFile } from "fs/promises";
import path from "path";
import { test } from "vitest";

import { login } from "../auth/login";
import { getClasses } from "./get-classes";

test("Get classes from Kadmos", async () => {
  const jar = await login(
    "IGS Lilienthal",
    "hauke.studienbuch",
    "App#Hauke2024",
  );

  const response = await getClasses(jar);
});
