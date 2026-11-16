// The four states a record shows beside its words, as stickers (D85). StatusSticker draws one.
import { Sticker } from "@stu/ui/Sticker";
import * as Record from "effect/Record";

export * as StatusArt from "./StatusArt.ts";

const { circle, fill, stroke } = Sticker;

const { navy, greenDark, blue, yellow, red, white } = Sticker.color;

// The dark green keeps the white tick at 4.5:1, which the brand green doesn't.
const pieces = {
  /** Bestätigt, abgesichert, entschuldigt. */
  confirmed: [
    fill(greenDark, circle(12, 12, 8.6)),
    stroke(white, 2.3, "M8 12.4L10.8 15.2L16.2 9.2"),
  ],
  /** A signature or an excuse that isn't there. */
  missing: [fill(red, circle(12, 12, 8.6)), stroke(white, 2.3, "M9 9L15 15M15 9L9 15")],
  /** Something the student has to do. */
  attention: [
    fill(yellow, "M10.3 4.4a2 2 0 0 1 3.4 0l7.5 13a2 2 0 0 1-1.7 3H4.5a2 2 0 0 1-1.7-3Z"),
    stroke(navy, 2.2, "M12 9.4V13.8"),
    fill(navy, circle(12, 16.9, 1.2)),
  ],
  /** A change waiting for the network. */
  waiting: [
    fill(blue, "M7.2 19.2h10a4 4 0 0 0 .7-7.94A6 6 0 0 0 6.1 10.8 4.25 4.25 0 0 0 7.2 19.2Z"),
    stroke(white, 1.8, "M12 16.6v-5M9.9 13.6 12 11.5l2.1 2.1"),
  ],
} satisfies Record.ReadonlyRecord<string, ReadonlyArray<Sticker.Piece>>;

export type Status = keyof typeof pieces;

export const drawings = Record.map(pieces, Sticker.svg);
