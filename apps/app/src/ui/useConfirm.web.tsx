import { Button } from "@stu/ui/Button";
import { Text } from "@stu/ui/Text";
import { Theme } from "@stu/ui/Theme";
import { Tokens } from "@stu/ui/Tokens";
import { useFocusOnMount } from "@stu/ui/useFocusOnMount";
import * as Option from "effect/Option";
import { useCallback, useId, useState } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";

import type { Answer, Question } from "./useConfirm.tsx";

interface Asked {
  readonly question: Question;
  readonly answer: (answer: Answer) => void;
}

/**
 * useConfirm.tsx on the web, where the system alert does nothing: our dialog, as `dialog` for the
 * screen to render. It traps the focus, and Escape or a click beside it answers `cancel`.
 */
export function useConfirm() {
  const [asked, setAsked] = useState(Option.none<Asked>());

  const ask = useCallback(
    (question: Question) =>
      new Promise<Answer>((resolve) => {
        const answer = (given: Answer) => {
          setAsked(Option.none());
          resolve(given);
        };

        setAsked(Option.some({ question, answer }));
      }),
    [],
  );

  const dialog = Option.match(asked, {
    onNone: () => null,
    onSome: ({ question, answer }) => <Dialog question={question} onAnswer={answer} />,
  });

  return { ask, dialog };
}

function Dialog({
  question,
  onAnswer,
}: {
  readonly question: Question;
  readonly onAnswer: (answer: Answer) => void;
}) {
  const { color, elevation } = Theme.useTheme();
  const title = useFocusOnMount();
  const titleId = useId();
  const textId = useId();

  return (
    <Modal
      transparent
      animationType="fade"
      onRequestClose={() => onAnswer("cancel")}
      aria-labelledby={titleId}
      aria-describedby={textId}
    >
      <View style={styles.backdrop}>
        {/* A click beside the dialog cancels; Tab and screen readers skip it, Escape cancels. */}
        <Pressable
          tabIndex={-1}
          aria-hidden
          onPress={() => onAnswer("cancel")}
          style={[StyleSheet.absoluteFill, styles.scrim]}
        />
        <View
          style={[
            styles.card,
            {
              backgroundColor: color.surface,
              borderColor: color.cardEdge,
              boxShadow: elevation.float,
            },
          ]}
        >
          {/* The question takes the focus, so a screen reader reads it before the choices. */}
          <View ref={title} tabIndex={-1} style={styles.focusable}>
            <Text variant="title2" nativeID={titleId} accessibilityRole="header" aria-level={2}>
              {question.title}
            </Text>
          </View>
          <View nativeID={textId} style={styles.text}>
            {question.paragraphs.map((paragraph) => (
              <Text key={paragraph} style={{ color: color.inkSoft }}>
                {paragraph}
              </Text>
            ))}
          </View>
          <View style={styles.choices}>
            {question.instead === undefined ? null : (
              <Button label={question.instead} block onPress={() => onAnswer("instead")} />
            )}
            <Button
              label={question.proceed}
              kind="danger"
              block
              onPress={() => onAnswer("proceed")}
            />
            <Button label="Abbrechen" kind="secondary" block onPress={() => onAnswer("cancel")} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: Tokens.space.lg,
  },
  scrim: { backgroundColor: "rgba(0, 0, 0, 0.45)", cursor: "auto" },
  card: {
    width: "100%",
    maxWidth: 440,
    gap: Tokens.space.lg,
    padding: Tokens.layout.cardPadding,
    borderRadius: Tokens.radius.card,
    borderWidth: 1,
  },
  focusable: { outlineStyle: "solid", outlineWidth: 0 },
  text: { gap: Tokens.space.md },
  choices: { gap: Tokens.space.md },
});
