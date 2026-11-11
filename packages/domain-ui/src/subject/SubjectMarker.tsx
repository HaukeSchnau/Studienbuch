import { SubjectBlob } from "@stu/ui/SubjectBlob";
import { Theme } from "@stu/ui/Theme";

import { SubjectArt } from "./SubjectArt.ts";
import type { SubjectMark } from "./SubjectMark.ts";

/** A subject's blob with its art, in the subject's pastel for the colour scheme. */
export function SubjectMarker({
  mark,
  size,
}: {
  readonly mark: SubjectMark.Mark;
  readonly size?: number;
}) {
  const { subject } = Theme.useTheme();
  const colors = subject[mark.slot];

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
