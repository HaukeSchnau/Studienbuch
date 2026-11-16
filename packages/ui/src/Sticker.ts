/**
 * The style of the app's illustrations (D85): flat pieces in one small palette, stuck on with a
 * white die-cut edge and a faint shadow. A sticker is a list of pieces on a 24-unit grid; `svg`
 * turns it into an SVG document for Drawing, with room around the grid for the edge.
 */
export * as Sticker from "./Sticker.ts";

/** The brand's navy, green and blue, plus yellow, coral and teal, and the steps between. */
export const color = {
  navy: "#203755",
  green: "#3CB043",
  greenDark: "#25883A",
  greenLight: "#C9F2BC",
  blue: "#3B7FD9",
  blueLight: "#A9CBFA",
  yellow: "#FFC531",
  yellowDark: "#E09A0B",
  /** A rim for yellow on white, at 4.1:1. */
  amber: "#B06F00",
  coral: "#FF6B57",
  red: "#E8443A",
  teal: "#2BB5A6",
  tealLight: "#A6EDE3",
  terracotta: "#E57A3D",
  wood: "#F2D49B",
  cream: "#FFF4DA",
  glass: "#E6F4FF",
  /** White in shade: a folded corner, a sole. */
  mist: "#D5E2F4",
  white: "#FFFFFF",
} as const;

export type Piece =
  | { readonly fill: string; readonly d: string }
  | { readonly stroke: string; readonly width: number; readonly d: string };

export const fill = (paint: string, d: string): Piece => ({ fill: paint, d });

/** A line with round ends, `width` units wide. */
export const stroke = (paint: string, width: number, d: string): Piece => ({
  stroke: paint,
  width,
  d,
});

const n = (value: number) => String(Math.round(value * 100) / 100);

/** A circle as path data, for `fill` and `stroke`. */
export const circle = (x: number, y: number, r: number) =>
  `M${n(x - r)} ${n(y)}a${n(r)} ${n(r)} 0 1 0 ${n(2 * r)} 0a${n(r)} ${n(r)} 0 1 0 ${n(-2 * r)} 0`;

// The edge is every piece again in white, 1.4 units wider all round. Behind it, a navy halo 0.6
// units wider still draws the cut on white and pale surfaces, where the edge alone disappears, and a
// navy shadow sits 0.9 units lower. Each is one group, so overlapping pieces don't darken it.
const edge = 2.8;

// Each piece's path is written once and drawn four times with `<use>`: the landing page inlines
// every sticker in its HTML, and four copies of each path tripled the page.
// In a layer, `widen` is set and the layer's group gives the paint. On top, a piece has its own.
const use = (piece: Piece, index: number, widen?: number) => {
  const ref = `<use href='#p${String(index)}'`;

  if ("fill" in piece) {
    return widen === undefined
      ? `${ref} fill='${piece.fill}'/>`
      : `${ref} stroke-width='${n(widen)}'/>`;
  }

  return widen === undefined
    ? `${ref} fill='none' stroke='${piece.stroke}' stroke-width='${n(piece.width)}'/>`
    : `${ref} fill='none' stroke-width='${n(piece.width + widen)}'/>`;
};

const layer = (pieces: ReadonlyArray<Piece>, paint: string, widen: number, attributes = "") =>
  `<g fill='${paint}' stroke='${paint}'${attributes}>` +
  pieces.map((piece, index) => use(piece, index, widen)).join("") +
  `</g>`;

/** The sticker as a whole SVG document, its 24-unit grid inset by the edge's 1.5 units. */
export const svg = (pieces: ReadonlyArray<Piece>) =>
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='-1.5 -1.5 27 27' stroke-linecap='round' stroke-linejoin='round'>` +
  `<defs>${pieces.map((piece, index) => `<path id='p${String(index)}' d='${piece.d}'/>`).join("")}</defs>` +
  layer(pieces, color.navy, edge + 1.2, ` opacity='.1'`) +
  layer(pieces, color.navy, edge, ` opacity='.18' transform='translate(0 .9)'`) +
  layer(pieces, color.white, edge) +
  pieces.map((piece, index) => use(piece, index)).join("") +
  `</svg>`;
