import { SubjectBlob } from "@stu/ui/SubjectBlob";
import { Theme } from "@stu/ui/Theme";
import type { Tokens } from "@stu/ui/Tokens";
import type * as Record from "effect/Record";

import { GradeArt } from "./GradeArt.ts";

// Each kind keeps its own blob, whatever course it is in.
const seeds: Record.ReadonlyRecord<GradeArt.Kind, number> = { Overall: 1, Oral: 6, Written: 11 };

/** A kind of grade as its sticker on a blob in the course's pastel. */
export function GradeMarker({
  kind,
  slot,
  size,
}: {
  readonly kind: GradeArt.Kind;
  readonly slot: Tokens.SubjectSlot;
  readonly size?: number;
}) {
  const { subject } = Theme.useTheme();

  return (
    <SubjectBlob
      drawing={GradeArt.drawings[kind]}
      label=""
      tint={subject[slot].tint}
      ink={subject[slot].text}
      seed={seeds[kind]}
      size={size}
    />
  );
}
