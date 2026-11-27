// The phones have no arrow keys to speak of, so only the web listens (ArrowKeys.web.tsx).

/** What `←` and `→` do on the web while the screen is focused. */
export interface ArrowKeysProps {
  readonly left: () => void;
  readonly right: () => void;
}

/** `←` and `→` for a screen, such as the weeks of Meine Woche: only a browser has them. */
export function ArrowKeys(_props: ArrowKeysProps) {
  return null;
}
