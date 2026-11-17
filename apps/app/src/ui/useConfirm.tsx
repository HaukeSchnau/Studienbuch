import { useCallback } from "react";
import { Alert, type AlertButton, Platform } from "react-native";

/** A question before a destructive step. "Abbrechen" comes with every one. */
export interface Question {
  readonly title: string;
  readonly paragraphs: ReadonlyArray<string>;
  /** The step it guards, drawn as destructive, such as "Trotzdem abmelden". */
  readonly proceed: string;
  /** A safer way on, offered first, such as "Notfallkarte erstellen". */
  readonly instead?: string | undefined;
}

/** `cancel` also when the question closes without a choice. */
export type Answer = "proceed" | "instead" | "cancel";

/**
 * Asks before a destructive step with the system alert. React Native Web's Alert does nothing, so
 * `useConfirm.web.tsx` draws our dialog, and a screen renders `dialog` for it. Here it is empty.
 * While `askable` is false, as once the notebook locks, a question answers `cancel` without
 * showing. The app can't close a system alert, so one already open stays until answered.
 */
export function useConfirm(askable = true) {
  const ask = useCallback(
    (question: Question) =>
      new Promise<Answer>((resolve) => {
        if (!askable) {
          resolve("cancel");

          return;
        }

        const cancel: AlertButton = {
          text: "Abbrechen",
          style: "cancel",
          onPress: () => resolve("cancel"),
        };

        const proceed: AlertButton = {
          text: question.proceed,
          style: "destructive",
          onPress: () => resolve("proceed"),
        };

        const instead: ReadonlyArray<AlertButton> =
          question.instead === undefined
            ? []
            : [{ text: question.instead, onPress: () => resolve("instead") }];

        // Android shows the last button as positive, the one before as negative and a third one
        // apart on the left. iOS puts Abbrechen last on its own.
        const buttons =
          Platform.OS === "android"
            ? instead.length === 0
              ? [cancel, proceed]
              : [proceed, cancel, ...instead]
            : [...instead, proceed, cancel];

        Alert.alert(question.title, question.paragraphs.join("\n\n"), buttons, {
          cancelable: true,
          onDismiss: () => resolve("cancel"),
        });
      }),
    [askable],
  );

  return { ask, dialog: null };
}
