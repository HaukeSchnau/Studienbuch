import { Theme } from "@stu/ui/Theme";
import { Tokens } from "@stu/ui/Tokens";
import { Card } from "@stu/ui/Card";
import { Icon } from "@stu/ui/Icon";
import { Text } from "@stu/ui/Text";
import { Image, Pressable, StyleSheet, View } from "react-native";

export interface Exam {
  readonly id: string;
  readonly points: number;
  readonly title: string;
  readonly date: string;
  /** Who has signed: the teacher in the app, the parents on the student's device. */
  readonly teacher: boolean;
  readonly parents: boolean;
}

const art = { oral: "/art/muendl.svg", written: "/art/schriftl.svg" } as const;

/**
 * Stand-in for the course page's grade card ("Deine Noten", variant B) until M1 builds it in
 * packages/domain-ui. `average` is the mean of the confirmed exams, which the caller computes.
 * "Unterschreiben lassen" calls `onSign`; in the app it opens the signature pad.
 */
export function GradesCard({
  oral,
  average,
  exams,
  onSign,
}: {
  oral: { readonly points: number; readonly date: string; readonly confirmed: boolean };
  average: number | undefined;
  exams: ReadonlyArray<Exam>;
  onSign?: (id: string) => void;
}) {
  const { color } = Theme.useTheme();

  return (
    <Card style={styles.card}>
      <Text variant="title2" style={{ color: color.accent }}>
        Deine Noten
      </Text>
      <Summary
        art={art.oral}
        caption={`Mündliche Note, Stand ${oral.date}`}
        confirmed={oral.confirmed}
        points={oral.points}
      />
      <View style={[styles.divider, { backgroundColor: color.hairline }]} />
      <Summary
        art={art.written}
        caption="Schnitt der bestätigten Klausuren"
        confirmed={false}
        points={average}
      />
      <View style={styles.exams}>
        {exams.map((exam) => (
          <ExamTile exam={exam} key={exam.id} onSign={onSign} />
        ))}
      </View>
    </Card>
  );
}

function Summary({
  art,
  points,
  caption,
  confirmed,
}: {
  art: string;
  points: number | undefined;
  caption: string;
  confirmed: boolean;
}) {
  const { color } = Theme.useTheme();

  return (
    <View style={styles.summary}>
      {/* `defaultSource` makes react-native-web render the image while prerendering. */}
      <Image defaultSource={{ uri: art }} source={{ uri: art }} style={styles.art} />
      <View style={styles.grow}>
        <Text variant="figure">
          {points ?? "–"}
          <Text variant="title3"> Punkte</Text>
        </Text>
        <Text variant="subhead" weight="regular" style={{ color: color.inkSoft }}>
          {caption}
        </Text>
        {confirmed ? <Confirmed /> : null}
      </View>
    </View>
  );
}

function Confirmed() {
  const { color } = Theme.useTheme();

  return (
    <View style={styles.status}>
      <Icon color={color.accent} name="checkBadge" size={16} />
      <Text variant="footnote" style={{ color: color.accent }}>
        bestätigt
      </Text>
    </View>
  );
}

function ExamTile({ exam, onSign }: { exam: Exam; onSign: ((id: string) => void) | undefined }) {
  const { color } = Theme.useTheme();
  const confirmed = exam.teacher && exam.parents;

  return (
    <View
      style={[styles.tile, { backgroundColor: confirmed ? color.accentTint : color.warningTint }]}
    >
      <Text variant="title1" style={[styles.points, { color: color.ink }]}>
        {exam.points}
      </Text>
      <View style={styles.grow}>
        <View style={styles.tileHeader}>
          <View style={styles.grow}>
            <Text variant="headline" style={{ color: color.ink }}>
              {exam.title}
            </Text>
            <Text variant="subhead" weight="regular" style={{ color: color.inkSoft }}>
              Klausur vom {exam.date}
            </Text>
          </View>
          {confirmed ? <Confirmed /> : null}
        </View>
        {confirmed ? null : (
          <>
            <View style={styles.signers}>
              <Signer done={exam.teacher} label="Lehrkraft" />
              <Signer done={exam.parents} label="Eltern fehlen" />
            </View>
            {onSign === undefined ? null : (
              <Pressable
                accessibilityRole="button"
                onPress={() => onSign(exam.id)}
                style={({ pressed }) => [
                  styles.button,
                  { backgroundColor: color.action },
                  pressed && styles.pressed,
                ]}
              >
                <Text variant="callout" weight="bold" style={{ color: color.onAction }}>
                  Unterschreiben lassen
                </Text>
              </Pressable>
            )}
          </>
        )}
      </View>
    </View>
  );
}

function Signer({ done, label }: { done: boolean; label: string }) {
  const { color } = Theme.useTheme();
  const tone = done ? color.accent : color.warning;

  return (
    <View style={styles.signer}>
      {done ? (
        <Icon color={tone} name="check" size={16} />
      ) : (
        <Icon color={tone} name="openBadge" size={14} />
      )}
      <Text variant="footnote" style={{ color: tone }}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: Tokens.layout.cardPadding, gap: Tokens.space.lg },
  summary: { flexDirection: "row", alignItems: "center", gap: Tokens.space.lg },
  art: { width: 56, height: 56 },
  grow: { flex: 1 },
  divider: { height: StyleSheet.hairlineWidth },
  status: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: Tokens.space.xs },
  exams: { gap: Tokens.space.sm },
  tile: {
    flexDirection: "row",
    gap: Tokens.space.md,
    borderRadius: Tokens.radius.tile,
    paddingVertical: Tokens.space.md,
    paddingHorizontal: Tokens.space.lg,
  },
  // Wide enough that the exam titles start on the same line as the texts beside the art above:
  // tile padding + points + gap = art + gap.
  points: { width: 44 },
  tileHeader: { flexDirection: "row", alignItems: "flex-start", gap: Tokens.space.sm },
  signers: { flexDirection: "row", gap: Tokens.space.lg, marginTop: Tokens.space.sm },
  signer: { flexDirection: "row", alignItems: "center", gap: Tokens.space.xs },
  button: {
    alignSelf: "flex-start",
    marginTop: Tokens.space.md,
    borderRadius: Tokens.radius.pill,
    paddingHorizontal: Tokens.space.lg + Tokens.space.xs,
    minHeight: 44,
    justifyContent: "center",
    cursor: "pointer",
  },
  pressed: { transform: [{ scale: Tokens.motion.press.scale }] },
});
