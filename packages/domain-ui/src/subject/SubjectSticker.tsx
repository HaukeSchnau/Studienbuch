import { Drawing } from "@stu/ui/Drawing";

import { SubjectArt } from "./SubjectArt.ts";

/** A subject's sticker without its blob, for a surface in the subject's own colour. */
export function SubjectSticker({
  art,
  size,
}: {
  readonly art: SubjectArt.Name;
  readonly size: number;
}) {
  return <Drawing xml={SubjectArt.drawings[art]} size={size} />;
}
