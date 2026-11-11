import { Blob } from "@stu/ui/Blob";
import type { Blobs } from "@stu/ui/Blobs";
import { Text } from "@stu/ui/Text";
import { Theme } from "@stu/ui/Theme";
import type { Tokens } from "@stu/ui/Tokens";
import { Vector } from "@stu/ui/Vector";
import { StyleSheet } from "react-native";

import { SubjectDrawings } from "./SubjectDrawings.ts";
import type { SubjectLook } from "./SubjectLook.ts";

export interface SubjectMarkProps {
  readonly look: SubjectLook.Look;
  /** 36 beside a row's title, 34 on a homework card, 40 in the agenda. */
  readonly size?: number;
}

/**
 * The one marker of a subject everywhere: a soft blob in the subject's pastel holding its drawing,
 * or its letters where we have no drawing. It is decoration next to the subject's name, so screen
 * readers skip it.
 */
export function SubjectMark({ look, size = 36 }: SubjectMarkProps) {
  const { subject } = Theme.useTheme();
  const [form, turn] = blobs[look.slot];

  return (
    <Blob form={form} turn={turn} color={subject[look.slot].tint} size={size}>
      {look.art === undefined ? (
        <Text
          aria-hidden
          allowFontScaling={false}
          style={[
            styles.letters,
            { color: subject[look.slot].text, fontSize: size * 0.36, lineHeight: size * 0.44 },
          ]}
        >
          {look.letters}
        </Text>
      ) : (
        <Vector
          width={size * drawn}
          height={size * drawn}
          viewBox={SubjectDrawings.drawings[look.art].viewBox}
          paths={SubjectDrawings.drawings[look.art].paths}
        />
      )}
    </Blob>
  );
}

// The drawing's share of the blob, as in brand direction A.
const drawn = 0.56;

// Each colour has its own outline and turn, so two markers side by side never match.
const blobs: Readonly<Record<Tokens.SubjectSlot, readonly [Blobs.Form, number]>> = {
  rust: ["kidney", 0],
  blue: ["twin", 20],
  violet: ["pinch", -15],
  green: ["notch", 40],
  teal: ["kidney", 120],
  amber: ["twin", -60],
  magenta: ["pinch", 90],
  indigo: ["notch", -100],
  slate: ["kidney", 200],
  red: ["twin", 150],
  cyan: ["pinch", 160],
  olive: ["notch", 170],
};

const styles = StyleSheet.create({ letters: { fontWeight: "700" } });
