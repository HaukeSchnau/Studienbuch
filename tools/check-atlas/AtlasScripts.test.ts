import { expect, it } from "@effect/vitest";

import { AtlasScripts } from "./AtlasScripts.ts";

const atlas = `<html>
<p>The atlas</p>
<script>const INFO = {
  "m-migr": { t: "Migrations", d: ["prepare applies them."] },
};
</script>
</html>`;

it("passes a script that compiles, and fails when it finds none", () => {
  expect(AtlasScripts.unparsable(atlas)).toEqual([]);
  expect(AtlasScripts.unparsable(atlas.replace("<script>", '<script type="text/plain">'))).toEqual([
    "no <script> found",
  ]);
});

it("names the atlas line of a dropped quote", () => {
  const dropped = atlas.replace('"prepare applies them."', '"prepare applies them.');

  expect(AtlasScripts.unparsable(dropped)).toEqual([
    "line 4: SyntaxError: Invalid or unexpected token",
  ]);
});
