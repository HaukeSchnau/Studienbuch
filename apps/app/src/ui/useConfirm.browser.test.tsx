import { RegistryContext, useAtomValue } from "@effect/atom-react";
import { expect, it } from "@effect/vitest";
import { Button } from "@stu/ui/Button";
import * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { page } from "vite-plus/test/browser";

import { render } from "../infra/testing/render.tsx";
import { type Answer, useConfirm } from "./useConfirm.tsx";

const locked = Atom.make(false);

/** A homework's delete button as its page has it, asking while the notebook is readable. */
function Delete({ answers }: { readonly answers: Array<Answer> }) {
  const confirm = useConfirm(!useAtomValue(locked));

  const ask = () =>
    confirm
      .ask({ title: "Hausaufgabe löschen?", paragraphs: ["Vokabeln lernen"], proceed: "Löschen" })
      .then((answer) => answers.push(answer));

  return (
    <>
      <Button label="Hausaufgabe löschen" onPress={() => void ask()} />
      {confirm.dialog}
    </>
  );
}

// The question names the homework, so it mustn't stay open once the notebook locks.
it("closes an open question as cancel once it can't be asked any more", async () => {
  const registry = AtomRegistry.make();
  const answers: Array<Answer> = [];

  await using view = await render(
    <RegistryContext.Provider value={registry}>
      <Delete answers={answers} />
    </RegistryContext.Provider>,
  );

  await view.getByRole("button", { name: "Hausaufgabe löschen" }).click();
  await expect.element(page.getByText("Vokabeln lernen")).toBeVisible();

  registry.set(locked, true);

  await expect.element(page.getByText("Vokabeln lernen")).not.toBeInTheDocument();
  await expect.poll(() => answers).toEqual(["cancel"]);
});
