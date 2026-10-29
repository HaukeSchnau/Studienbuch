import { useAtom, useAtomSet, useAtomValue } from "@effect/atom-react";
import { Due } from "@stu/domain-ui/homework/Due";
import { RefusalText } from "@stu/domain-ui/refusal/RefusalText";
import { SubjectColor } from "@stu/domain-ui/subject/SubjectColor";
import { Card } from "@stu/ui/Card";
import { Text } from "@stu/ui/Text";
import { Theme } from "@stu/ui/Theme";
import { Tokens } from "@stu/ui/Tokens";
import * as Cause from "effect/Cause";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Option from "effect/Option";
import * as Predicate from "effect/Predicate";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import { Pressable, StyleSheet, TextInput, View } from "react-native";

import { Lab } from "./Lab.ts";
import { LabAccounts } from "./LabAccounts.ts";
import { Chip, Line, mono, OnlineSwitch, Section } from "./LabControls.tsx";
import { LabDevice } from "./LabDevice.ts";

const latencies = [0, 300, 1000, 3000];

const nextLatency = (millis: number) =>
  latencies[(latencies.indexOf(millis) + 1) % latencies.length] ?? 0;

const connections = { online: "verbunden", connecting: "verbindet", offline: "getrennt" } as const;

/** The tag of the last control's failure, such as `LabDevice.NotAdmitted`. */
const failureOf = (result: AsyncResult.AsyncResult<unknown, unknown>) => {
  if (!AsyncResult.isFailure(result)) return undefined;
  const error = Cause.squash(result.cause);

  return Predicate.hasProperty(error, "_tag") && Predicate.isString(error._tag)
    ? error._tag
    : "Defekt";
};

type Space = LabDevice.Snapshot["spaces"][number];

const versionOf = (space: Space) => (space.version === null ? "noch nichts" : `v${space.version}`);

/**
 * The cursors as the pane lists them: the notebook and the school one by one, and the course
 * spaces in one line, since a device doesn't know which course a course space is for.
 */
const cursors = (spaces: ReadonlyArray<Space>, persona: LabAccounts.Persona) => {
  const courses = spaces.flatMap((space) => (space.kind === "course" ? [space.version ?? 0] : []));
  const low = Math.min(...courses);
  const high = Math.max(...courses);

  return [
    ...spaces.flatMap((space) =>
      space.kind === "course"
        ? []
        : [
            {
              key: space.id,
              text:
                space.kind === "notebook" ? `Notizbuch ${LabAccounts.names[persona]}` : "Schule",
              right: versionOf(space),
            },
          ],
    ),
    ...(courses.length === 0
      ? []
      : [
          {
            key: "courses",
            text: `${courses.length} Kurse`,
            right: low === high ? `v${high}` : `v${low} bis v${high}`,
          },
        ]),
  ];
};

/** One device of the Lab: its controls, its homework, its outbox and what it pulled. */
export function DevicePane({ id }: { readonly id: LabDevice.Id }) {
  const { color, elevation } = Theme.useTheme();
  const spec = LabDevice.specs[id];
  const engine = AsyncResult.value(useAtomValue(Lab.engine(id)));
  const reading = useAtomValue(Lab.snapshot(id));
  const held = AsyncResult.value(reading);
  const unreadable = failureOf(reading);
  const status = AsyncResult.value(useAtomValue(Lab.status(id)));
  const settings = AsyncResult.value(useAtomValue(Lab.settings(id)));
  const failure = failureOf(useAtomValue(Lab.act(id)));
  const act = useAtomSet(Lab.act(id));
  const [draft, setDraft] = useAtom(Lab.draft(id));

  const offline = Option.exists(settings, (current) => current.offline);

  const latency = Option.match(settings, {
    onNone: () => 0,
    onSome: (current) => Duration.toMillis(current.latency),
  });

  const armed = (fault: "dropNextResponse" | "duplicateNextPush") =>
    Option.exists(settings, (current) => current[fault]) ? "armed" : "plain";

  const add = () => {
    if (draft.trim() === "") return;
    act(Lab.Action.Add({ device: id, title: draft.trim() }));
    setDraft("");
  };

  const engineLine = Option.match(engine, {
    onNone: () => "startet",
    onSome: (current) =>
      current._tag === "Running"
        ? Option.match(status, {
            onNone: () => "startet",
            onSome: (now) =>
              [connections[now.connection], now.pushing ? "sendet" : "", now.pulling ? "holt" : ""]
                .filter((part) => part !== "")
                .join(", "),
          })
        : current._tag === "Starting"
          ? "startet"
          : `startet nicht: ${current.reason}`,
  });

  return (
    <Card style={[styles.pane, offline ? { borderColor: color.warning, borderWidth: 2 } : null]}>
      <View style={styles.head}>
        <View style={styles.title}>
          <Text variant="title3">Gerät {id.toUpperCase()}</Text>
          <Text variant="footnote" style={{ color: color.inkSoft }}>
            {spec.label} · {engineLine}
          </Text>
        </View>
        <OnlineSwitch
          offline={offline}
          onChange={(next) => act(Lab.Action.Offline({ device: id, offline: next }))}
        />
      </View>

      <View style={styles.chips}>
        <Chip
          label={`Latenz ${latency} ms`}
          tone={latency > 0 ? "armed" : "plain"}
          onPress={() => act(Lab.Action.Latency({ device: id, millis: nextLatency(latency) }))}
        />
        <Chip
          label="Antwort verwerfen"
          tone={armed("dropNextResponse")}
          onPress={() => act(Lab.Action.Arm({ device: id, fault: "dropNextResponse" }))}
        />
        <Chip
          label="Push doppeln"
          tone={armed("duplicateNextPush")}
          onPress={() => act(Lab.Action.Arm({ device: id, fault: "duplicateNextPush" }))}
        />
        <Chip label="Absturz" onPress={() => act(Lab.Action.Crash({ device: id }))} />
        <Chip label="Löschen" onPress={() => act(Lab.Action.Wipe({ device: id }))} />
      </View>

      {id === "a" ? (
        <View style={styles.chips}>
          <Chip
            label="In ein anderes Notizbuch senden"
            tone="danger"
            onPress={() => act(Lab.Action.SealIntoOther({ device: id }))}
          />
          <Chip
            label="Kurs wählen, der nicht angeboten wird"
            tone="danger"
            onPress={() => act(Lab.Action.ChooseNotOffered({ device: id }))}
          />
        </View>
      ) : null}

      {unreadable === undefined ? null : (
        <Text variant="footnote" style={[styles.padded, { color: color.danger }]}>
          Lesen ging nicht: {unreadable}
        </Text>
      )}

      {failure === undefined ? null : (
        <Text variant="footnote" style={[styles.padded, { color: color.danger }]}>
          Ging nicht: {failure}
        </Text>
      )}

      {Option.match(held, {
        onNone: () => null,
        onSome: (snapshot) => (
          <>
            {snapshot.refusals.map((refusal) => (
              <View
                key={`${refusal.clientId} ${refusal.mutationId}`}
                style={[
                  styles.refusal,
                  {
                    backgroundColor: color.surface,
                    borderLeftColor: color.danger,
                    boxShadow: elevation.card,
                  },
                ]}
              >
                <Text variant="headline" style={{ color: color.danger }}>
                  {RefusalText.title}
                </Text>
                <Text variant="callout" style={{ color: color.inkSoft }}>
                  {RefusalText.sentence(refusal.reason)}
                </Text>
                <View style={styles.refusalFoot}>
                  <Text variant="footnote" style={[mono, { color: color.inkSoft }]}>
                    #{refusal.mutationId} {refusal.name} · {refusal.reason._tag}
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => act(Lab.Action.Dismiss({ device: id, refusal }))}
                  >
                    <Text variant="footnote" style={{ color: color.action }}>
                      Ausblenden
                    </Text>
                  </Pressable>
                </View>
              </View>
            ))}

            <Section title="Hausaufgaben" count={snapshot.homework.length}>
              {snapshot.homework.map((homework) => (
                <Line
                  key={homework.id}
                  leading={
                    <View
                      style={[
                        styles.dot,
                        {
                          backgroundColor:
                            Tokens.subject[SubjectColor.ofCourse(homework.course)].fill,
                        },
                      ]}
                    />
                  }
                  text={homework.title}
                  right={homework.waiting ? "wartet" : Due.label(homework, snapshot.today)}
                  rightColor={homework.waiting ? color.warning : undefined}
                />
              ))}
              <View style={styles.add}>
                <TextInput
                  value={draft}
                  onChangeText={setDraft}
                  onSubmitEditing={add}
                  placeholder="Neue Hausaufgabe"
                  placeholderTextColor={color.inkSoft}
                  style={[styles.input, { borderColor: color.hairline, color: color.ink }]}
                />
                <Chip label="Hinzufügen" onPress={add} />
              </View>
            </Section>

            <Section title="Ausgang" count={snapshot.outbox.length}>
              {snapshot.outbox.length === 0 ? (
                <Text variant="callout" style={{ color: color.inkSoft }}>
                  leer
                </Text>
              ) : (
                snapshot.outbox.map((command) => (
                  <Line
                    key={command.mutationId}
                    mono
                    text={`#${command.mutationId} ${command.name}`}
                    right="wartet"
                    rightColor={color.warning}
                  />
                ))
              )}
            </Section>

            <Section title="Stand">
              {cursors(snapshot.spaces, spec.persona).map((line) => (
                <Line key={line.key} text={line.text} right={line.right} rightColor={color.ink} />
              ))}
              <Line
                text="Zuletzt geholt"
                right={Option.match(
                  Option.fromNullishOr(
                    snapshot.spaces
                      .flatMap((space) => (space.syncedAt === null ? [] : [space.syncedAt]))
                      .sort(DateTime.Order)
                      .at(-1),
                  ),
                  {
                    onNone: () => "noch nie",
                    onSome: (at) => `um ${DateTime.toDate(at).toLocaleTimeString("de-DE")}`,
                  },
                )}
                rightColor={color.ink}
              />
            </Section>
          </>
        ),
      })}
    </Card>
  );
}

const styles = StyleSheet.create({
  pane: { flex: 1, minWidth: 320, gap: Tokens.space.md, paddingTop: Tokens.layout.cardPadding },
  head: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: Tokens.space.md,
    paddingHorizontal: Tokens.layout.cardPadding,
  },
  title: { flexShrink: 1, gap: Tokens.space.xxs },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Tokens.space.sm,
    paddingHorizontal: Tokens.layout.cardPadding,
  },
  padded: { paddingHorizontal: Tokens.layout.cardPadding },
  refusal: {
    marginHorizontal: Tokens.space.lg,
    padding: Tokens.space.lg,
    gap: Tokens.space.xs,
    borderRadius: Tokens.radius.tile,
    borderLeftWidth: 4,
  },
  refusalFoot: { flexDirection: "row", justifyContent: "space-between", gap: Tokens.space.sm },
  dot: { width: 10, height: 10, borderRadius: 5 },
  add: { flexDirection: "row", alignItems: "center", gap: Tokens.space.sm },
  input: {
    flex: 1,
    // A text field keeps its content's width unless told otherwise, and Firefox pushed the button out.
    minWidth: 0,
    borderWidth: 1,
    borderRadius: Tokens.radius.cell,
    paddingHorizontal: Tokens.space.md,
    paddingVertical: Tokens.space.xs,
    minHeight: 36,
    fontSize: Tokens.type.callout.size,
    lineHeight: Tokens.type.callout.line,
  },
});
