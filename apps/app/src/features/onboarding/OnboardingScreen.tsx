import { useAtom, useAtomSet, useAtomValue } from "@effect/atom-react";
import {
  Course,
  NotebookProfile,
  SchoolClass,
  type CourseOffering,
  type Enrollment,
  type School,
} from "@stu/core";
import { RefusalText } from "@stu/domain-ui/refusal/RefusalText";
import { AuthHeading } from "@stu/ui/AuthHeading";
import { Button } from "@stu/ui/Button";
import { Checkbox } from "@stu/ui/Checkbox";
import { Field } from "@stu/ui/Field";
import { Link } from "@stu/ui/Link";
import * as Option from "effect/Option";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Schema from "effect/Schema";
import { Keyboard, StyleSheet, View } from "react-native";

import { AuthShell } from "../../ui/AuthShell.tsx";
import { Form, Lead, ProblemBox } from "../account/AccountForm.tsx";
import { SignOutButton } from "../account/SignOutButton.tsx";
import { CourseTiles, PillChoice } from "./Choices.tsx";
import { Onboarding } from "./Onboarding.ts";
import { OnboardingState } from "./OnboardingState.ts";

export interface OnboardingScreenProps {
  readonly accountId: string;
  /** Not `NoSchool`: the gate lets that student through. */
  readonly reading: Onboarding.Reading;
}

/**
 * The first start after sign-up, in the Flutter app's two steps and the old web's card: who you
 * are (name, Jahrgang, "volljährig"), then Klasse and the elective courses. The answers are a
 * draft in the account's database, so a reload or a restart picks up where the student was.
 */
export function OnboardingScreen({ accountId, reading }: OnboardingScreenProps) {
  const draft = useAtomValue(OnboardingState.draft(accountId));

  return (
    <AuthShell>
      {reading._tag !== "Ready" || !AsyncResult.isSuccess(draft) ? (
        <Waiting />
      ) : (
        <Steps
          accountId={accountId}
          snapshot={reading.snapshot}
          start={Onboarding.next(reading)}
          draft={draft.value}
        />
      )}
      <View style={styles.signOut}>
        <SignOutButton pending={0} />
      </View>
    </AuthShell>
  );
}

/** Before the notebook's and the school's first rows arrived. */
function Waiting() {
  return (
    <>
      <AuthHeading>Einen Moment …</AuthHeading>
      <Lead>Dein Studienbuch holt gerade die Daten deiner Schule.</Lead>
    </>
  );
}

interface StepsProps {
  readonly accountId: string;
  readonly snapshot: Onboarding.Snapshot;
  readonly start: Onboarding.Step;
  readonly draft: OnboardingState.Draft;
}

function Steps({ accountId, snapshot, start, draft }: StepsProps) {
  const answers = answersOf(snapshot, draft);
  const canChoose = Option.isSome(answers.term) && answers.levels.length > 0;
  const step = canChoose ? (draft.step ?? (start === "courses" ? "courses" : "who")) : "who";

  return step === "who" ? (
    <WhoStep accountId={accountId} snapshot={snapshot} draft={draft} canChoose={canChoose} />
  ) : (
    <CoursesStep accountId={accountId} snapshot={snapshot} draft={draft} />
  );
}

const decodeName = Schema.decodeUnknownOption(NotebookProfile.DisplayName);

/** The answers: the draft's where the student gave one, otherwise what the notebook holds. */
const answersOf = (snapshot: Onboarding.Snapshot, draft: OnboardingState.Draft) => {
  const term = snapshot.term;
  const earlier = Option.flatMap(term, (each) => each.enrollment);
  const levels = Option.match(term, { onNone: () => [], onSome: Onboarding.gradeLevels });
  const name = draft.name ?? snapshot.profile.displayName ?? "";

  const gradeLevel = Option.orElse(Option.fromNullishOr(draft.gradeLevel), () =>
    Option.orElse(
      Option.map(earlier, (each) => each.gradeLevel),
      () => (levels.length === 1 ? Option.fromNullishOr(levels[0]) : Option.none()),
    ),
  );

  const classId = Option.map(
    Option.orElse(Option.fromNullishOr(draft.classId), () =>
      Option.flatMap(earlier, (each) => Option.fromNullishOr(each.classId)),
    ),
    (id) => SchoolClass.Id.make(id),
  );

  return {
    term,
    levels,
    name,
    displayName: decodeName(name.trim()),
    adult: draft.adult ?? snapshot.profile.adult ?? false,
    gradeLevel,
    classId,
    chosen: (choices: Onboarding.TermChoices, chooser: CourseOffering.Chooser) =>
      draft.chosen === null
        ? Onboarding.startingChoice(choices, chooser)
        : new Set(draft.chosen.map((id) => Course.Id.make(id))),
  };
};

function WhoStep({
  accountId,
  snapshot,
  draft,
  canChoose,
}: Omit<StepsProps, "start"> & { readonly canChoose: boolean }) {
  const answers = answersOf(snapshot, draft);
  const save = useAtomSet(OnboardingState.draft(accountId));

  const ready =
    Option.isSome(answers.displayName) && (!canChoose || Option.isSome(answers.gradeLevel));

  return (
    <>
      <AuthHeading>Willkommen!</AuthHeading>
      <Lead>
        {canChoose
          ? "Bitte gib deinen Namen und deinen Jahrgang an."
          : "Bitte gib deinen Namen an."}
      </Lead>
      <Form>
        <Field
          pill
          label="Name"
          value={answers.name}
          onChangeText={(name) => save({ ...draft, name })}
          autoComplete="given-name"
          textContentType="givenName"
          autoCorrect={false}
          maxLength={80}
          returnKeyType="next"
          onSubmitEditing={() => Keyboard.dismiss()}
        />
        {canChoose ? (
          <PillChoice
            label="Jahrgang"
            options={answers.levels.map((level) => ({ value: level, label: String(level) }))}
            value={answers.gradeLevel}
            onChange={(level: School.GradeLevel) =>
              save({ ...draft, gradeLevel: level, classId: null, chosen: null })
            }
          />
        ) : null}
        <Checkbox
          label="Ich bin volljährig."
          checked={answers.adult}
          onChange={(adult) => save({ ...draft, adult })}
        />
        {canChoose ? (
          <Button
            kind="action"
            label="Weiter"
            block
            disabled={!ready}
            onPress={() => {
              Keyboard.dismiss();
              save({ ...draft, step: "courses" });
            }}
          />
        ) : (
          <Finish accountId={accountId} snapshot={snapshot} draft={draft} disabled={!ready} />
        )}
      </Form>
    </>
  );
}

function CoursesStep({ accountId, snapshot, draft }: Omit<StepsProps, "start">) {
  const answers = answersOf(snapshot, draft);
  const save = useAtomSet(OnboardingState.draft(accountId));

  return Option.match(Option.all([answers.term, answers.gradeLevel]), {
    onNone: () => null,
    onSome: ([term, gradeLevel]) => {
      const classes = Onboarding.classesOf(term, gradeLevel);

      const chooser = {
        termId: term.id,
        gradeLevel,
        classId: Option.getOrUndefined(answers.classId),
      };

      const electives = Onboarding.electives(term, chooser);
      const chosen = answers.chosen(term, chooser);
      const ready = classes.length === 0 || Option.isSome(answers.classId);

      return (
        <>
          <AuthHeading>{classes.length === 0 ? "Kurse" : "Klassen und Kurse"}</AuthHeading>
          <Lead>
            {classes.length === 0
              ? "Bitte wähle deine Kurse aus. Tippe auf die Fächer, um deine Kurse auszuwählen."
              : "Bitte wähle deine Klasse und deine Wahlpflichtkurse aus. Tippe auf die Fächer, um deine Kurse auszuwählen."}
          </Lead>
          <Form>
            {classes.length === 0 ? null : (
              <PillChoice
                label="Klasse"
                options={classes.map((each) => ({ value: each.id, label: each.name }))}
                value={answers.classId}
                onChange={(id: string) => save({ ...draft, classId: id, chosen: null })}
              />
            )}
            {electives.length === 0 ? null : (
              <CourseTiles
                electives={electives}
                chosen={chosen}
                onToggle={(elective) =>
                  save({ ...draft, chosen: [...Onboarding.toggle(chosen, elective, electives)] })
                }
              />
            )}
            {Option.match(snapshot.refused, {
              onNone: () => null,
              onSome: (refused) => <ProblemBox>{RefusalText.sentence(refused.reason)}</ProblemBox>,
            })}
            <Finish
              accountId={accountId}
              snapshot={snapshot}
              draft={draft}
              disabled={!ready}
              choice={{
                termId: term.id,
                gradeLevel,
                classId: chooser.classId,
                courseIds: Onboarding.courseIds(term, chooser, chosen),
              }}
            />
            <View style={styles.center}>
              <Link
                variant="subhead"
                label="Zurück"
                onPress={() => save({ ...draft, step: "who" })}
              />
            </View>
          </Form>
        </>
      );
    },
  });
}

function Finish({
  accountId,
  snapshot,
  draft,
  disabled,
  choice,
}: Omit<StepsProps, "start"> & {
  readonly disabled: boolean;
  /** The course choice of the second step; the first step finishes without one. */
  readonly choice?: Omit<typeof Enrollment.set.args.Type, "notebook">;
}) {
  const answers = answersOf(snapshot, draft);
  const [result, finish] = useAtom(OnboardingState.finish(accountId));

  return (
    <>
      {Option.match(AsyncResult.error(result), {
        onNone: () => null,
        onSome: (error) => <ProblemBox>{RefusalText.sentence(error)}</ProblemBox>,
      })}
      <Button
        kind="action"
        label="Fertig"
        block
        disabled={disabled}
        busy={result.waiting}
        onPress={() =>
          Option.map(answers.displayName, (displayName) =>
            finish({
              notebook: snapshot.id,
              displayName,
              adult: answers.adult,
              choice: Option.map(Option.fromNullishOr(choice), (each) => ({
                ...each,
                notebook: snapshot.id,
              })),
              refused: snapshot.refused,
            }),
          )
        }
      />
    </>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center" },
  signOut: { alignItems: "center", marginTop: 20 },
});
