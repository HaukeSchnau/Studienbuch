import { Drawing } from "@stu/ui/Drawing";

import { StatusArt } from "./StatusArt.ts";

/** A state as its sticker, for the start of the line that names it. */
export function StatusSticker({
  status,
  size,
}: {
  readonly status: StatusArt.Status;
  readonly size: number;
}) {
  return <Drawing xml={StatusArt.drawings[status]} size={size} />;
}
