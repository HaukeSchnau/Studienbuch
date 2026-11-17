import { useAtom, useAtomSet, useAtomValue } from "@effect/atom-react";
import { Access } from "@stu/api/Access";
import { AuthHeading } from "@stu/ui/AuthHeading";
import { Button } from "@stu/ui/Button";
import { Field } from "@stu/ui/Field";
import { SuccessTick } from "@stu/ui/SuccessTick";
import { Theme } from "@stu/ui/Theme";
import * as Exit from "effect/Exit";
import * as Option from "effect/Option";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { Keyboard, StyleSheet, type TextInputSelectionChangeEvent } from "react-native";

import { AccessCode } from "./AccessCode.ts";
import { Form, Lead, OtherWay, ProblemBox } from "./AccountForm.tsx";
import { Steps } from "./Steps.ts";
import { TypedCode } from "./TypedCode.ts";

/**
 * "Willkommen!": the access code from the school, the old web's first step. A whole code earns a
 * tick before the server is asked, and a code the server takes leads to "Konto erstellen" with its
 * school named. Changing the code clears the last refusal, and the way back finds the code again.
 */
export function WelcomeScreen() {
  const router = useRouter();
  const [result, redeem] = useAtom(AccessCode.redeem, { mode: "promiseExit" });
  const forget = useAtomSet(AccessCode.redeem);
  const keep = useAtomSet(Steps.reservation);
  const keepCode = useAtomSet(Steps.accessCode);
  const typed = Option.getOrElse(useAtomValue(Steps.accessCode), () => "");
  const code = useAccessCode(typed, () => forget(Atom.Reset));
  const complete = Access.isCode(code.value);
  const reason = reasonOf(result);

  const submit = async () => {
    if (!complete) return;

    Keyboard.dismiss();
    const exit = await redeem({ payload: { code: code.value } });

    if (Exit.isSuccess(exit)) {
      keep(Option.some(exit.value));
      keepCode(Option.some(code.value));
      router.push("/konto-erstellen");
    }
  };

  return (
    <>
      <AuthHeading>Willkommen!</AuthHeading>
      <Lead>Gib den Zugangscode ein, den du von deiner Schule bekommen hast.</Lead>
      <Form>
        <Field
          pill
          label="Zugangscode"
          hint="Groß- und Kleinschreibung sind egal, die Bindestriche setzen wir selbst."
          value={code.value}
          onChangeText={code.set}
          selection={code.selection}
          onSelectionChange={code.onSelectionChange}
          placeholder="XXXX-XXXX-XXXX-XXXX"
          autoCapitalize="characters"
          autoComplete="off"
          autoCorrect={false}
          spellCheck={false}
          returnKeyType="go"
          onSubmitEditing={() => void submit()}
          invalid={Option.isSome(reason)}
          inputStyle={styles.code}
          trailing={
            // The tick says the code is whole; a code the server refused gets the error alone.
            complete && Option.isNone(reason) ? (
              <SuccessTick size={24} delay={0} label="Code vollständig" />
            ) : undefined
          }
        />
        {Option.match(reason, {
          onNone: () => null,
          onSome: (found) => <ProblemBox>{AccessCode.sentence[found]}</ProblemBox>,
        })}
        <Button
          kind="action"
          label={result.waiting ? "Wird geprüft …" : "Weiter"}
          block
          disabled={!complete}
          busy={result.waiting}
          onPress={() => void submit()}
        />
      </Form>
      <OtherWay question="Schon ein Konto?" label="Anmelden" href="/anmelden" />
    </>
  );
}

/**
 * The code as printed on the school's paper, from `initial`: repaired as it is typed, hyphens set
 * in, and the caret behind what was typed (`TypedCode.access`). Rewriting the text would move the
 * caret to the end, so `selection` sets it once after each edit and lets go at the next move.
 * `onEdit` runs when the code changes, so an answer about the old code goes.
 */
export function useAccessCode(initial: string, onEdit: () => void) {
  const [value, setValue] = useState(initial);
  const [selection, setSelection] = useState<TypedCode.Selection | undefined>(undefined);
  const before = useRef<TypedCode.Selection>({ start: initial.length, end: initial.length });

  return {
    value,
    selection,
    onSelectionChange: (event: TextInputSelectionChangeEvent) => {
      before.current = event.nativeEvent.selection;
      setSelection(undefined);
    },
    set: (text: string) => {
      const next = TypedCode.access(value, text, before.current);

      if (next.value !== value) onEdit();
      before.current = { start: next.caret, end: next.caret };
      setValue(next.value);
      setSelection(before.current);
    },
  };
}

const reasonOf = (result: AsyncResult.AsyncResult<unknown, { readonly _tag: string }>) =>
  Option.map(AsyncResult.error(result), AccessCode.reasonOf);

// The old web's code field: centred, monospaced, spaced out. 0.1 em rather than its 0.2, so the
// iPhone's wider Menlo fits a whole code beside the tick.
const styles = StyleSheet.create({
  code: {
    textAlign: "center",
    letterSpacing: 1.6,
    fontFamily: Theme.codeFontFamily,
  },
});
