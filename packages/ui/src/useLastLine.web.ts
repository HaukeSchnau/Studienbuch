/// <reference lib="dom" />
import { useRef, useState, type ComponentRef } from "react";
import type { View } from "react-native";

import type { LastLine, Line } from "./useLastLine.ts";

/**
 * useLastLine.ts on the web, where text reports no lines: the DOM gives the boxes of the lines of
 * the text inside the view, measured again whenever the view's size changes.
 */
export function useLastLine(): LastLine {
  const [line, setLine] = useState<Line | undefined>(undefined);
  const node = useRef<unknown>(null);

  return {
    line,
    container: {
      ref: (view: ComponentRef<typeof View> | null) => {
        node.current = view;
      },
      onLayout: () => {
        const element = node.current;

        if (!(element instanceof HTMLElement)) return;

        // The text node alone: the elements around it have boxes of their own.
        const text = document.createTreeWalker(element, NodeFilter.SHOW_TEXT).nextNode();

        if (text === null) return;

        const range = document.createRange();

        range.selectNodeContents(text);

        const lines = range.getClientRects();
        const last = lines[lines.length - 1];
        const box = element.getBoundingClientRect();

        if (last !== undefined) {
          setLine({
            x: last.left - box.left,
            y: last.top - box.top,
            width: last.width,
            height: last.height,
          });
        }
      },
    },
    text: {},
  };
}
