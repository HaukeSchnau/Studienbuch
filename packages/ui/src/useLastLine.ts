import { useState, type ComponentRef, type Ref } from "react";
import type { TextLayoutEvent, TextProps, View, ViewProps } from "react-native";

/** Where a text's last line sits inside the view around it. */
export interface Line {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** What the measuring needs: spread `container` on the view around the text, `text` on the text. */
export interface LastLine {
  readonly line: Line | undefined;
  readonly container: Pick<ViewProps, "onLayout"> & {
    readonly ref?: Ref<ComponentRef<typeof View>>;
  };
  readonly text: Pick<TextProps, "onTextLayout">;
}

/**
 * The last line of a text, for a drawing that follows it, as the swoosh under a title that wraps.
 * The phones report their lines; the web measures them (useLastLine.web.ts).
 */
export function useLastLine(): LastLine {
  const [line, setLine] = useState<Line | undefined>(undefined);

  return {
    line,
    container: {},
    text: {
      onTextLayout: (event: TextLayoutEvent) => {
        const { lines } = event.nativeEvent;
        const last = lines[lines.length - 1];

        if (last !== undefined) {
          setLine({ x: last.x, y: last.y, width: last.width, height: last.height });
        }
      },
    },
  };
}
