import { useAtom } from "@effect/atom-react";
import { Button } from "@stu/ui/Button";
import * as Exit from "effect/Exit";
import * as Option from "effect/Option";
import { Keyboard } from "react-native";

import { ProblemText, reasonOf } from "../account/AccountForm.tsx";
import { CardCodeField, KeyProblem, keyReasonOf } from "./KeysUi.tsx";
import { KeysState } from "./KeysState.ts";
import { useTypedCode } from "./RecoveryCodeScreen.tsx";

/**
 * "Kurz bestätigen" with the Notfallkarte, for an account without an address, whose card signs
 * in. `kind` is "quiet" below another way to confirm.
 */
export function ConfirmByCard({
  accountId,
  kind = "filled",
  onConfirmed,
}: {
  readonly accountId: string;
  readonly kind?: "filled" | "quiet";
  readonly onConfirmed: () => void;
}) {
  const [code, setCode] = useTypedCode();
  const [result, confirm] = useAtom(KeysState.withCard(accountId), { mode: "promiseExit" });
  const keyReason = keyReasonOf(result);

  const submit = async () => {
    if (code.trim() === "" || result.waiting) return;

    Keyboard.dismiss();

    if (Exit.isSuccess(await confirm(code))) onConfirmed();
  };

  return (
    <>
      <CardCodeField
        value={code}
        onChangeText={setCode}
        onSubmitEditing={() => void submit()}
        invalid={Option.isSome(keyReason) || Option.isSome(reasonOf(result))}
      />
      <KeyProblem reason={keyReason} />
      <ProblemText reason={reasonOf(result)} />
      <Button
        label="Mit Notfallkarte bestätigen"
        kind={kind}
        block
        busy={result.waiting}
        disabled={code.trim() === ""}
        onPress={() => void submit()}
      />
    </>
  );
}
