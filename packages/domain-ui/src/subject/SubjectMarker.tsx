import { SubjectBlob } from "@stu/ui/SubjectBlob";
import { Theme } from "@stu/ui/Theme";
import { Tokens } from "@stu/ui/Tokens";

import { SubjectArt } from "./SubjectArt.ts";
import type { SubjectMark } from "./SubjectMark.ts";

/** A subject's blob with its art, in the subject's pastel for the colour scheme. */
export function SubjectMarker({
  mark,
  size,
  light = false,
}: {
  readonly mark: SubjectMark.Mark;
  readonly size?: number;
  /** The light scheme's pastel in both schemes, for a surface that is dark in both. */
  readonly light?: boolean;
}) {
  const { subject } = Theme.useTheme();
  const colors = light ? Tokens.subject[mark.slot] : subject[mark.slot];

  return (
    <SubjectBlob
      drawing={mark.art === undefined ? undefined : SubjectArt.drawings[mark.art]}
      label={mark.letters}
      tint={colors.tint}
      ink={colors.text}
      seed={mark.seed}
      size={size}
    />
  );
}
