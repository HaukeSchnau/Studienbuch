// The subjects as stickers (D85): one object per subject, drawn for Studienbuch in the shared
// palette. Languages are things from the country, never flags. SubjectMark.ts picks one per
// subject, and @stu/ui's SubjectBlob draws it on the subject's blob.
import { Sticker } from "@stu/ui/Sticker";
import * as Record from "effect/Record";

export * as SubjectArt from "./SubjectArt.ts";

const { circle, fill, stroke } = Sticker;

const {
  navy,
  green,
  greenDark,
  greenLight,
  blue,
  blueLight,
  yellow,
  yellowDark,
  coral,
  red,
  teal,
  tealLight,
  terracotta,
  wood,
  cream,
  glass,
  mist,
  white,
} = Sticker.color;

const pieces = {
  /** A calculator. */
  math: [
    fill(
      blue,
      "M7.6 3h8.8a2.6 2.6 0 0 1 2.6 2.6v12.8a2.6 2.6 0 0 1-2.6 2.6H7.6A2.6 2.6 0 0 1 5 18.4V5.6A2.6 2.6 0 0 1 7.6 3Z",
    ),
    fill(
      cream,
      "M7.5 5.2h9a.8.8 0 0 1 .8.8v2.8a.8.8 0 0 1-.8.8h-9a.8.8 0 0 1-.8-.8V6a.8.8 0 0 1 .8-.8Z",
    ),
    stroke(navy, 1, "M13.6 7.4h2"),
    fill(white, circle(8.6, 12.3, 1.1)),
    fill(white, circle(12, 12.3, 1.1)),
    fill(yellow, circle(15.4, 12.3, 1.1)),
    fill(white, circle(8.6, 15.6, 1.1)),
    fill(white, circle(12, 15.6, 1.1)),
    fill(yellow, circle(15.4, 15.6, 1.1)),
    fill(white, circle(8.6, 18.6, 0.9)),
    fill(white, circle(12, 18.6, 0.9)),
    fill(coral, circle(15.4, 18.6, 0.9)),
  ],
  /** An open book with a bookmark. */
  german: [
    fill(coral, "M2.2 6.6V19.8C6 19.2 9.6 19.6 12 21C14.4 19.6 18 19.2 21.8 19.8V6.6Z"),
    fill(cream, "M12 6.6C9.8 5.2 6.6 4.6 3.4 5.2V18.4C6.6 17.8 9.8 18.2 12 19.6Z"),
    fill(white, "M12 6.6C14.2 5.2 17.4 4.6 20.6 5.2V18.4C17.4 17.8 14.2 18.2 12 19.6Z"),
    stroke(
      blueLight,
      0.9,
      "M5.4 8.6C7 8.4 8.6 8.6 10.2 9.2M5.4 11.2C7 11 8.6 11.2 10.2 11.8M5.4 13.8C7 13.6 8.6 13.8 10.2 14.4M13.8 11.8C15.4 11.2 17 11 18.6 11.2M13.8 14.4C15.4 13.8 17 13.6 18.6 13.8",
    ),
    fill(yellow, "M15.6 5V10.6L16.8 9.5L18 10.6V4.7Z"),
  ],
  /** A London bus. */
  english: [
    fill(
      red,
      "M5 3.6h14a2 2 0 0 1 2 2v11.6a1.4 1.4 0 0 1-1.4 1.4H4.4A1.4 1.4 0 0 1 3 17.2V5.6a2 2 0 0 1 2-2Z",
    ),
    fill(blueLight, "M4.7 5.6h14.6v3.4H4.7Z"),
    fill(blueLight, "M4.7 11.2h9.4v3.4H4.7Z"),
    fill(blueLight, "M15.8 11.2h3.5v5.6h-3.5Z"),
    stroke(red, 1, "M9.6 5.6v3.4M14.4 5.6v3.4M9.4 11.2v3.4"),
    stroke(yellow, 0.8, "M3 10.1h18"),
    fill(navy, circle(7.4, 18.8, 1.9)),
    fill(navy, circle(16.6, 18.8, 1.9)),
    fill(white, circle(7.4, 18.8, 0.6)),
    fill(white, circle(16.6, 18.8, 0.6)),
  ],
  /** Running shoes. */
  sport: [
    fill(
      coral,
      "M3 15.6C3 12.8 3.6 9.8 4.6 8.2C5.2 7.4 6.4 7.6 7 8.4C7.8 9.6 9.4 10 10.6 9.4L12.2 8.6C14.4 11.2 17.2 12.6 20.2 13.2C21.4 13.4 21.8 14.4 21.6 15.6Z",
    ),
    fill(white, "M2.8 15.6H21.7C21.8 17.2 21.2 18.4 19.8 18.4H4.4C3.4 18.4 2.8 17.6 2.8 15.6Z"),
    stroke(mist, 0.6, "M3.4 17h17.8"),
    stroke(white, 0.9, "M10.6 11.4L12 10.6M12 12.5L13.4 11.7M13.5 13.4L14.9 12.6"),
    stroke(yellow, 1.2, "M6.4 14C9.6 14.6 13.4 14 16.6 12.6"),
  ],
  /** A leaf with a ladybird. */
  biology: [
    fill(
      green,
      "M4.2 20C3.6 12.4 7.4 5.6 15 4.4C17 4.1 18.8 4.2 20.2 4.4C20.6 7.8 20 11.2 18.4 14C15.6 18.6 10.6 20.4 4.2 20Z",
    ),
    fill(
      greenDark,
      "M4.2 20C10.4 14.6 14.4 10 19.9 4.6C20.4 7.8 19.8 11.2 18.2 14C15.4 18.6 10.4 20.4 4.2 20Z",
    ),
    stroke(greenLight, 1, "M3.2 21C8.6 15.6 13.6 10.4 18.4 6.2"),
    fill(coral, circle(15.6, 15, 2.5)),
    fill(navy, circle(14.1, 13.3, 1.1)),
    stroke(navy, 0.6, "M14.6 13.9L17.2 16.6"),
    fill(navy, circle(16.5, 14.2, 0.45)),
    fill(navy, circle(14.8, 16.1, 0.45)),
  ],
  /** A flask with something bubbling in it. */
  chemistry: [
    fill(
      glass,
      "M9.6 2.8h4.8v1.6h-.6v4.8l5 8.4c.9 1.6-.2 3.4-2 3.4H7.2c-1.8 0-2.9-1.8-2-3.4l5-8.4V4.4h-.6Z",
    ),
    fill(
      teal,
      "M7 13.5C9 12.7 10.6 14.1 12.2 13.5C13.8 12.9 15.4 12.9 17 13.5L18.8 16.6C19.7 18.2 18.6 20 16.8 20H7.2C5.4 20 4.3 18.2 5.2 16.6Z",
    ),
    fill(white, circle(10.4, 17.2, 1)),
    fill(white, circle(13.8, 16, 0.65)),
    fill(tealLight, circle(12.6, 10.6, 0.75)),
    fill(tealLight, circle(11.2, 7.8, 0.55)),
    stroke(navy, 1, "M9.6 2.8h4.8"),
  ],
  /** A horseshoe magnet. */
  physics: [
    fill(red, "M4.6 5.6H9.4V13.4A2.6 2.6 0 0 0 14.6 13.4V5.6H19.4V13.4A7.4 7.4 0 0 1 4.6 13.4Z"),
    fill(blueLight, "M4.6 5.6H9.4V9H4.6Z"),
    fill(blueLight, "M14.6 5.6H19.4V9H14.6Z"),
    stroke(yellow, 1.2, "M7 2.4V1.6M12 4.2V2.6M17 2.4V1.6"),
  ],
  /** An amphora. */
  history: [
    fill(
      terracotta,
      "M9 3.4h6v1.2c0 .8-.6 1.2-.6 2 0 .6 1.4 1.2 2.4 2.6 1.4 2 1.4 5.2 0 7.6-1 1.8-2.4 2.8-2.4 3.6v.8H9.6v-.8c0-.8-1.4-1.8-2.4-3.6-1.4-2.4-1.4-5.6 0-7.6 1-1.4 2.4-2 2.4-2.6 0-.8-.6-1.2-.6-2Z",
    ),
    stroke(terracotta, 1.4, "M9.6 5.8C7.6 5.6 6.6 7 7.4 8.8M14.4 5.8C16.4 5.6 17.4 7 16.6 8.8"),
    fill(navy, "M6.6 11.2h10.8v2.2H6.6Z"),
    fill(yellow, circle(9, 12.3, 0.55)),
    fill(yellow, circle(12, 12.3, 0.55)),
    fill(yellow, circle(15, 12.3, 0.55)),
    fill(navy, "M9.6 20.4h4.8v1H9.6Z"),
  ],
  /** A globe on its stand. */
  geography: [
    stroke(yellowDark, 1.3, "M12 1.8A8.2 8.2 0 0 1 12 18.2"),
    fill(blue, circle(12, 10, 6.8)),
    fill(
      green,
      "M8.2 5.2C9.8 4.6 11.2 5.2 11.4 6.6C11.6 7.8 10.4 8.4 10.6 9.6C10.8 10.8 12.2 11.2 11.8 12.6C11.4 13.8 9.8 14.2 8.8 13.2C7.8 12.2 8.2 10.8 7.2 10C6.4 9.4 5.6 9.2 5.6 8.2C5.8 6.8 6.8 5.8 8.2 5.2Z",
    ),
    fill(
      green,
      "M14.4 8C15.6 7.4 17.4 7.8 18 9C18.6 10.4 17.6 11.6 16.8 12.8C16.2 13.8 15 14.4 14.4 13.4C13.8 12.4 14.8 11.4 14.2 10.4C13.8 9.6 13.6 8.4 14.4 8Z",
    ),
    fill(yellowDark, "M11.2 18H12.8V20.4H11.2Z"),
    fill(navy, "M8.4 20h7.2a1.1 1.1 0 0 1 0 2.2H8.4a1.1 1.1 0 0 1 0-2.2Z"),
  ],
  /** A ballot going into the box. */
  politics: [
    fill(white, "M8.4 2.6L16 3.2L15.4 12.6L7.8 12Z"),
    stroke(red, 1.2, "M10.2 5.4L13 8.2M13 5.4L10.2 8.2"),
    fill(
      blue,
      "M4.6 10.6h14.8a1 1 0 0 1 1 1v8.6a1.2 1.2 0 0 1-1.2 1.2H4.8a1.2 1.2 0 0 1-1.2-1.2v-8.6a1 1 0 0 1 1-1Z",
    ),
    fill(navy, "M7.4 12.4h9.2v1.4H7.4Z"),
    fill(yellow, "M9.6 16.4h4.8v2h-4.8Z"),
  ],
  /** A candle. */
  religion: [
    fill(
      yellow,
      "M12 1.8C13.6 3.8 14.8 5.4 14.8 7C14.8 8.6 13.6 9.8 12 9.8C10.4 9.8 9.2 8.6 9.2 7C9.2 5.4 10.4 3.8 12 1.8Z",
    ),
    fill(
      coral,
      "M12 5C12.8 6 13.3 6.8 13.3 7.6C13.3 8.4 12.7 9 12 9C11.3 9 10.7 8.4 10.7 7.6C10.7 6.8 11.2 6 12 5Z",
    ),
    fill(wood, "M8.6 11.4C8.6 10.8 9 10.4 9.6 10.4H14.4C15 10.4 15.4 10.8 15.4 11.4V20.6H8.6Z"),
    fill(
      cream,
      "M13 10.4H14.4C15 10.4 15.4 10.8 15.4 11.4V14.2C14.6 14.2 14 13.6 14 12.8V12.2C14 11.6 13.6 11.2 13 11.2Z",
    ),
    stroke(navy, 0.9, "M12 10.4V9.2"),
    fill(blue, "M5.4 20.2h13.2a1.2 1.2 0 0 1 0 2.4H5.4a1.2 1.2 0 0 1 0-2.4Z"),
  ],
  /** Scales. */
  ethics: [
    fill(navy, "M11 5.4h2v13h-2Z"),
    fill(navy, "M7.6 21.4L9.4 18H14.6L16.4 21.4Z"),
    stroke(navy, 1.5, "M4.4 6.8H19.6"),
    stroke(navy, 0.7, "M4.4 6.8L2.6 12.4M4.4 6.8L6.2 12.4M19.6 6.8L17.8 12.4M19.6 6.8L21.4 12.4"),
    fill(yellow, "M1.8 12.4h5.2a2.6 2.6 0 0 1-5.2 0Z"),
    fill(yellow, "M17 12.4h5.2a2.6 2.6 0 0 1-5.2 0Z"),
    fill(yellow, circle(12, 4.6, 1.6)),
  ],
  /** A presentation board with a chart. */
  seminar: [
    stroke(navy, 1.3, "M8.6 15.4L6 21.6M15.4 15.4L18 21.6M12 15.4V20.6"),
    fill(white, "M3.4 4h17.2v11.4a.8.8 0 0 1-.8.8H4.2a.8.8 0 0 1-.8-.8Z"),
    fill(
      navy,
      "M2.6 2.6h18.8a.8.8 0 0 1 .8.8v.8a.8.8 0 0 1-.8.8H2.6a.8.8 0 0 1-.8-.8v-.8a.8.8 0 0 1 .8-.8Z",
    ),
    fill(green, "M6 10.2h2.6v3.8H6Z"),
    fill(blue, "M10.2 7.2h2.6v6.8h-2.6Z"),
    fill(coral, "M14.4 8.8H17v5.2h-2.6Z"),
  ],
  /** A palette and a brush. */
  art: [
    fill(
      wood,
      "M12.3 3.6C7 3.5 3.4 7.4 3.5 12.2C3.6 16.8 7.2 20.5 11.6 20.4C13 20.4 13.7 19.6 13.6 18.6C13.5 17.2 12.2 16.9 12.3 15.6C12.4 14.6 13.2 14.1 14.3 14.1L16.4 14.1C19 14.2 20.7 12.4 20.6 9.9C20.5 6.4 16.9 3.7 12.3 3.6Z",
    ),
    fill(coral, circle(7.4, 12.2, 1.6)),
    fill(blue, circle(8.9, 7.8, 1.45)),
    fill(yellow, circle(13.1, 6.6, 1.45)),
    fill(green, circle(17, 8.9, 1.45)),
    stroke(navy, 1.7, "M21.2 13.6L16.6 18.2"),
    fill(red, "M16.9 17.8C16.2 18.8 15.2 20.4 13.9 20.9C13.8 19.6 14.6 18.4 15.9 17.4Z"),
  ],
  /** Two notes. */
  music: [
    fill(navy, "M9 6.6L19.6 4V7.4L9 10Z"),
    fill(navy, "M9 6.6h1.6v11.2H9Z"),
    fill(navy, "M18 4.4h1.6v11.2H18Z"),
    fill(blue, circle(7.4, 17.8, 2.6)),
    fill(blue, circle(16.4, 15.6, 2.6)),
  ],
  /** Theatre masks. */
  drama: [
    fill(
      blue,
      "M10.6 3.2C13.8 2 18.2 2 21.4 3.2C21.6 9 19.8 13.4 16 14.6C12.2 13.4 10.4 9 10.6 3.2Z",
    ),
    stroke(navy, 1, "M12.8 6.6C13.3 5.9 14.3 5.9 14.8 6.6M17.2 6.6C17.7 5.9 18.7 5.9 19.2 6.6"),
    fill(navy, "M13.4 11.6C14.4 9.8 17.6 9.8 18.6 11.6C17.4 11.1 14.6 11.1 13.4 11.6Z"),
    stroke(
      white,
      1.2,
      "M2.6 9.4C5.8 8.2 10.2 8.2 13.4 9.4C13.6 15.2 11.8 19.6 8 20.8C4.2 19.6 2.4 15.2 2.6 9.4Z",
    ),
    fill(
      yellow,
      "M2.6 9.4C5.8 8.2 10.2 8.2 13.4 9.4C13.6 15.2 11.8 19.6 8 20.8C4.2 19.6 2.4 15.2 2.6 9.4Z",
    ),
    stroke(navy, 1, "M4.8 12.6C5.3 11.8 6.3 11.8 6.8 12.6M9.2 12.6C9.7 11.8 10.7 11.8 11.2 12.6"),
    fill(navy, "M5 15C6.6 15.6 9.4 15.6 11 15C10.6 17.2 9.4 18.4 8 18.4C6.6 18.4 5.4 17.2 5 15Z"),
  ],
  /** The Eiffel tower. */
  french: [
    fill(navy, "M11.5 1.4h1v3h-1Z"),
    fill(navy, "M11 4.2H13L14.2 10.4H9.8Z"),
    fill(
      navy,
      "M9.4 12H14.6L19.2 21.6H15.6C15.2 18.4 13.8 16.6 12 16.6C10.2 16.6 8.8 18.4 8.4 21.6H4.8Z",
    ),
    fill(blue, "M8.4 10.2h7.2v1.8H8.4Z"),
    fill(blue, "M6.8 14.8h10.4v1.6H6.8Z"),
  ],
  /** A fan. */
  spanish: [
    fill(red, "M2.4 17.6A9.6 9.6 0 0 1 21.6 17.6Z"),
    fill(coral, "M12 17.6L3.13 13.93A9.6 9.6 0 0 1 5.21 10.81Z"),
    fill(coral, "M12 17.6L8.33 8.73A9.6 9.6 0 0 1 12 8Z"),
    fill(coral, "M12 17.6L15.67 8.73A9.6 9.6 0 0 1 18.79 10.81Z"),
    fill(coral, "M12 17.6L20.87 13.93A9.6 9.6 0 0 1 21.6 17.6Z"),
    stroke(yellow, 1, "M5 17.6A7 7 0 0 1 19 17.6"),
    fill(wood, "M10.8 16.6h2.4v4.6a1.2 1.2 0 0 1-2.4 0Z"),
    fill(navy, circle(12, 17.6, 1)),
  ],
  /** A centurion's helmet. */
  latin: [
    fill(
      red,
      "M3.6 8.4C4 4.4 7.6 1.8 12 1.8C16.4 1.8 20 4.4 20.4 8.4C17.8 7 15 6.4 12 6.4C9 6.4 6.2 7 3.6 8.4Z",
    ),
    stroke(coral, 0.8, "M7.4 4.6L8.2 6.4M12 3.4V6M16.6 4.6L15.8 6.4"),
    fill(navy, "M8.4 12.4H15.6V20C15.6 20.8 14.8 21.4 12 21.4C9.2 21.4 8.4 20.8 8.4 20Z"),
    fill(yellow, "M5 13.4C5 9.4 8.2 6.6 12 6.6C15.8 6.6 19 9.4 19 13.4Z"),
    fill(
      yellow,
      "M4.8 14H9.8C9.6 16.4 10 18.6 11 20.6C10.4 21.4 9.2 21.8 8 21.6C6 21.2 4.8 19.6 4.8 17.4Z",
    ),
    fill(
      yellow,
      "M19.2 14H14.2C14.4 16.4 14 18.6 13 20.6C13.6 21.4 14.8 21.8 16 21.6C18 21.2 19.2 19.6 19.2 17.4Z",
    ),
    fill(yellowDark, "M4.4 12.6H19.6V14.4H4.4Z"),
    fill(yellowDark, circle(7.2, 17, 0.7)),
    fill(yellowDark, circle(16.8, 17, 0.7)),
  ],
  /** A laptop with code. */
  computing: [
    fill(navy, "M5.8 4h12.4a1.2 1.2 0 0 1 1.2 1.2v10.4H4.6V5.2A1.2 1.2 0 0 1 5.8 4Z"),
    fill(teal, "M6.2 5.6h11.6v8.4H6.2Z"),
    stroke(white, 1.2, "M10 7.8L8.2 9.8L10 11.8M14 7.8L15.8 9.8L14 11.8"),
    stroke(yellow, 1.1, "M12.7 7.6L11.3 12"),
    fill(
      blueLight,
      "M2.4 15.6H21.6L20.8 18.2C20.6 18.8 20 19.2 19.4 19.2H4.6C4 19.2 3.4 18.8 3.2 18.2Z",
    ),
    fill(blue, "M10 15.6h4v1h-4Z"),
  ],
} satisfies Record.ReadonlyRecord<string, ReadonlyArray<Sticker.Piece>>;

export type Name = keyof typeof pieces;

/** Each subject's sticker as an SVG document. */
export const drawings = Record.map(pieces, Sticker.svg);
