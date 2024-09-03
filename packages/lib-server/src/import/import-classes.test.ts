import { test } from "vitest";

import { importClasses } from "./import-classes";

test("Import classes", async () => {
  await importClasses({
    school: "igs-lil",
  });
});
