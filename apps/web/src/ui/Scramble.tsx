import { useEffect, useRef, useState } from "react";

import { Motion } from "./Motion.ts";

const glyphs = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const duration = 700;

/**
 * The text to draw while `text` changes: for 700 ms after each change, characters settle from the
 * old text into the new one left to right, through a few frames of noise. Returns `text` itself on
 * the first render, while prerendering and whenever motion isn't welcome.
 */
export function useScrambled(text: string) {
  const [shown, setShown] = useState(text);
  const from = useRef(text);
  const motion = Motion.useAllowed();

  useEffect(() => {
    const start = from.current;
    from.current = text;

    if (!motion || start === text) {
      setShown(text);

      return;
    }

    const length = Math.max(start.length, text.length);
    const began = performance.now();

    let frame = requestAnimationFrame(function tick(now) {
      const progress = Math.min((now - began) / duration, 1);
      let next = "";

      for (let index = 0; index < length; index++) {
        // Each character settles a little after the one before it, after a spell of noise.
        const settle = 0.35 + (index / length) * 0.65;
        next +=
          progress >= settle
            ? (text[index] ?? "")
            : progress >= settle - 0.35
              ? (glyphs[Math.floor(Math.random() * glyphs.length)] ?? "")
              : (start[index] ?? "");
      }

      setShown(next);

      if (progress < 1) frame = requestAnimationFrame(tick);
    });

    return () => cancelAnimationFrame(frame);
  }, [text, motion]);

  return shown;
}

/** `text`, scrambling into place whenever it changes. Screen readers get the final text only. */
export function Scramble({ text }: { text: string }) {
  const shown = useScrambled(text);

  return (
    <>
      <span className="visually-hidden">{text}</span>
      <span aria-hidden>{shown}</span>
    </>
  );
}
