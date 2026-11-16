// The three kinds of grade (domain.md 2.5) as stickers (D85). GradeMarker draws them on a blob.
import { Sticker } from "@stu/ui/Sticker";
import * as Record from "effect/Record";

export * as GradeArt from "./GradeArt.ts";

const { circle, fill, stroke } = Sticker;

const { navy, blue, blueLight, yellow, yellowDark, coral, red, wood, mist, white } = Sticker.color;

const pieces = {
  /** Gesamtnote: a rosette. */
  Overall: [
    fill(blue, "M8.6 13.4L6.4 21L9.1 19.9L10.6 22L12.2 15.2Z"),
    fill(coral, "M15.4 13.4L17.6 21L14.9 19.9L13.4 22L11.8 15.2Z"),
    fill(yellow, circle(12, 10, 6.2)),
    stroke(yellowDark, 1, circle(12, 10, 4.6)),
    fill(
      white,
      "M12 7.2L12.73 8.99L14.66 9.13L13.19 10.39L13.65 12.27L12 11.25L10.35 12.27L10.81 10.39L9.34 9.13L11.27 8.99Z",
    ),
  ],
  /** Mündlich: a raised hand. */
  Oral: [
    fill(
      yellow,
      "M9.2 21C9 19.4 8.4 18.2 7.4 17C6.4 15.6 5.4 14 4.6 12.6C4.1 11.7 4.6 10.8 5.5 10.9C6.3 11 6.8 11.7 7.4 12.5L8.3 13.6L8.1 5.8C8.1 4.9 8.7 4.4 9.4 4.4C10.1 4.4 10.6 4.9 10.6 5.8L10.7 11L10.8 3.9C10.8 3 11.4 2.5 12.1 2.5C12.8 2.5 13.3 3 13.3 3.9L13.3 11L13.5 4.7C13.5 3.9 14.1 3.4 14.8 3.4C15.5 3.4 16 3.9 16 4.8L15.9 11.4L16.2 7.2C16.3 6.4 16.8 6 17.5 6C18.2 6.1 18.6 6.6 18.6 7.4L18.3 14.6C18.1 17 17 18.8 15.6 21Z",
    ),
    stroke(yellowDark, 0.8, "M10.65 11V6.2M13.4 11V5.2M16.05 11.4V7.4"),
    stroke(blue, 1.2, "M20.6 4.4C21.3 5.1 21.7 5.9 21.8 6.8M3.6 5C3 5.7 2.7 6.5 2.7 7.4"),
  ],
  /** Schriftlich: an exam sheet with the grade circled in red. */
  Written: [
    fill(
      white,
      "M5.4 2.8h9.8l3.8 3.8v13.8a.8.8 0 0 1-.8.8H5.4a.8.8 0 0 1-.8-.8V3.6a.8.8 0 0 1 .8-.8Z",
    ),
    fill(mist, "M15.2 2.8V6.6H19Z"),
    stroke(blueLight, 1, "M7.6 10.4h8.6M7.6 13h8.6M7.6 15.6h5"),
    stroke(red, 1.1, circle(9, 6.3, 1.9)),
    fill(yellow, "M14.6 19.4L20.4 13.6L22 15.2L16.2 21Z"),
    fill(wood, "M14.6 19.4L16.2 21L13.6 22Z"),
    fill(navy, "M13.95 21.15L14.45 21.65L13.6 22Z"),
  ],
} satisfies Record.ReadonlyRecord<string, ReadonlyArray<Sticker.Piece>>;

export type Kind = keyof typeof pieces;

export const drawings = Record.map(pieces, Sticker.svg);
