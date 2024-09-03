import { test } from "vitest";

import { copySubstitutions } from "./copyKadmosSubstitutions";

test("copy-kadmos-substitutions", async () => {
  await copySubstitutions("igs-lil", "TODAY");
});
