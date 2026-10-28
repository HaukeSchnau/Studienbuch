import { Theme } from "@stu/ui/Theme";
import { Tokens } from "@stu/ui/Tokens";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";

import { Check, CheckBadge } from "./Glyph.tsx";
import { Type } from "./Type.ts";

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
 * Stand-in for the course page's grade card ("Deine Noten", design-language.md variant B) until M1
 * builds it in packages/domain-ui. `average` is the mean of the confirmed exams, which the caller
 * computes. "Unterschreiben lassen" calls `onSign`; in the app it opens the signature pad.
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
  const { color, elevation } = Theme.useTheme();

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: color.surface, borderColor: color.cardEdge, boxShadow: elevation.card },
      ]}
    >
      <Text style={[Type.style("title2"), { color: color.accent }]}>Deine Noten</Text>
      <GradeSummary
        art={art.oral}
        caption={`Mündliche Note, Stand ${oral.date}`}
        confirmed={oral.confirmed}
        points={oral.points}
      />
      <View style={[styles.divider, { backgroundColor: color.hairline }]} />
      <GradeSummary
        art={art.written}
        caption="Schnitt der bestätigten Klausuren"
        confirmed={false}
        points={average}
      />
      {exams.map((exam) => (
        <ExamTile exam={exam} key={exam.id} onSign={onSign} />
      ))}
    </View>
  );
}

function GradeSummary({
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
        <Text style={{ color: color.ink }}>
          <Text style={Type.style("figure")}>{points ?? "–"}</Text>
          <Text style={Type.style("title2")}> Punkte</Text>
        </Text>
        <Text style={[Type.style("callout"), { color: color.inkSoft }]}>{caption}</Text>
        {confirmed ? <Confirmed /> : null}
      </View>
    </View>
  );
}

function Confirmed() {
  const { color } = Theme.useTheme();

  return (
    <View style={styles.status}>
      <CheckBadge color={color.accent} />
      <Text style={[Type.style("footnote"), styles.bold, { color: color.accent }]}>bestätigt</Text>
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
      <Text style={[Type.style("title1"), styles.tilePoints, { color: color.ink }]}>
        {exam.points}
      </Text>
      <View style={styles.grow}>
        <View style={styles.tileHeader}>
          <Text style={[Type.style("headline"), styles.grow, { color: color.ink }]}>
            {exam.title}
          </Text>
          {confirmed ? <Confirmed /> : null}
        </View>
        <Text style={[Type.style("callout"), { color: color.inkSoft }]}>
          Klausur vom {exam.date}
        </Text>
        {confirmed ? null : (
          <>
            <View style={styles.signers}>
              <Signer done={exam.teacher} label="Lehrkraft" />
              <Signer done={exam.parents} label={exam.parents ? "Eltern" : "Eltern fehlen"} />
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
                <Text style={[Type.style("headline"), { color: color.onAction }]}>
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
    <View style={styles.status}>
      {done ? (
        <Check color={tone} size={16} />
      ) : (
        <View style={[styles.open, { borderColor: tone }]} />
      )}
      <Text style={[Type.style("footnote"), styles.bold, { color: tone }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Tokens.radius.card,
    borderWidth: 1,
    padding: Tokens.layout.cardPadding,
    gap: Tokens.space.lg,
  },
  summary: { flexDirection: "row", alignItems: "center", gap: Tokens.space.lg },
  art: { width: 60, height: 60 },
  grow: { flex: 1 },
  divider: { height: 1 },
  status: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  bold: { fontWeight: "800" },
  tile: {
    flexDirection: "row",
    gap: Tokens.space.md,
    borderRadius: Tokens.radius.tile,
    padding: Tokens.space.lg,
  },
  tilePoints: { minWidth: 34 },
  tileHeader: { flexDirection: "row", alignItems: "center", gap: Tokens.space.sm },
  signers: { flexDirection: "row", gap: Tokens.space.lg, marginTop: Tokens.space.sm },
  open: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, marginHorizontal: 2 },
  button: {
    alignSelf: "flex-start",
    marginTop: Tokens.space.md,
    borderRadius: Tokens.radius.pill,
    paddingHorizontal: Tokens.space.xl,
    minHeight: Tokens.layout.minTarget,
    justifyContent: "center",
    cursor: "pointer",
  },
  pressed: { transform: [{ scale: Tokens.motion.press.scale }] },
});
