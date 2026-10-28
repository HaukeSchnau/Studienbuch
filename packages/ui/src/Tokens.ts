// Design tokens: the one source for the app, the landing page and the CSS variables `Theme` generates.
// Values are A9's (design-language.md, section 5, decided as D46 to D51).
export * as Tokens from "./Tokens.ts";

const light = {
  canvas: "#F9F9F9",
  surface: "#FFFFFF",
  raised: "#FFFFFF",
  // Navy: body text, and the tint of every shadow.
  ink: "#203755",
  inkSoft: "#5B6B80",
  // Decoration only, never the only cue.
  hairline: "#E4E8EE",
  // Light cards separate from the canvas by their shadow, dark cards by this border.
  cardEdge: "transparent",
  // Text green for text, icons and filled buttons. The brand green fails 4.5:1 with white (D50).
  accent: "#097D00",
  onAccent: "#FFFFFF",
  accentTint: "#EEF5ED",
  // Button blue for links and secondary buttons (D50).
  action: "#2A6FC7",
  onAction: "#FFFFFF",
  // Legacy accentDesaturated: pale blue panels behind ink.
  actionTint: "#EBF1F9",
  danger: "#A42B33",
  dangerTint: "#F6E1E3",
  warning: "#8D5703",
  warningTint: "#FEEDDA",
  // The brand green: hero fill and illustrations. Only large text sits on it.
  hero: "#33A42B",
  heroEdge: "#3B7FD9",
  // The homework panel. Only large text sits on it.
  panel: "#3B7FD9",
  panelCard: "#203755",
  panelTitle: "#3CC233",
  // The decorative blobs, drawn at 45 % opacity. Landing page, onboarding and empty states only.
  blobGreen: "#6DB868",
  blobBlue: "#76A6E5",
} as const;

export type ColorName = keyof typeof light;

export type Palette = Readonly<Record<ColorName, string>>;

const dark = {
  canvas: "#090F17",
  surface: "#131A24",
  raised: "#1B232E",
  ink: "#E7ECF2",
  inkSoft: "#A6AFBB",
  hairline: "#2C333D",
  cardEdge: "#2C333D",
  accent: "#65C55B",
  onAccent: "#06210A",
  accentTint: "#15291A",
  action: "#77ADF5",
  onAction: "#0B1B33",
  actionTint: "#132238",
  danger: "#F2979B",
  dangerTint: "#3D1D20",
  warning: "#E2A94F",
  warningTint: "#33240C",
  hero: "#1F6D18",
  heroEdge: "#5B9AED",
  panel: "#1B3A63",
  panelCard: "#0E1B2D",
  panelTitle: "#65C55B",
  blobGreen: "#1F5A1B",
  blobBlue: "#1E4170",
} as const satisfies Palette;

export const color = { light, dark } as const;

export type Scheme = keyof typeof color;

// Overrides under iOS Increase Contrast, Android high-contrast text and `prefers-contrast: more`.
export const highContrast = {
  light: { accent: "#066201", inkSoft: "#3E4C5E", action: "#1F5AA8", hairline: "#9AA6B4" },
  dark: { accent: "#8BDE80", inkSoft: "#CBD3DD", action: "#A4C8FA" },
} as const satisfies Record<Scheme, Partial<Palette>>;

// Native chrome on Android (tab bar, FAB): a static scheme, never Material You (D48). Hand-picked
// approximations of an M3 static scheme from `accent`.
export const androidChrome = {
  light: {
    container: "#EDF2EA",
    indicator: "#D5E8CD",
    onIndicator: "#102010",
    ripple: "rgba(9, 125, 0, 0.16)",
    fab: "#BDF0AE",
    onFab: "#062B00",
  },
  dark: {
    container: "#18201A",
    indicator: "#3B4B37",
    onIndicator: "#D5E8CD",
    ripple: "rgba(101, 197, 91, 0.2)",
    fab: "#1F5316",
    onFab: "#BDF0AE",
  },
} as const;

// Course colours, chosen by subject (D49). `fill` carries white labels at 6:1 or more in both schemes;
// `tint` and `text` are for list rows and badges.
export const subject = {
  red: {
    fill: "#BF2424",
    tint: "#FEEBE9",
    text: "#BA3535",
    tintDark: "#4D2623",
    textDark: "#E7867E",
  },
  rust: {
    fill: "#A84403",
    tint: "#FEECE4",
    text: "#AD4601",
    tintDark: "#4C2817",
    textDark: "#E38B63",
  },
  amber: {
    fill: "#8D5703",
    tint: "#FEEDDA",
    text: "#8F5B05",
    tintDark: "#462D0B",
    textDark: "#D49648",
  },
  olive: {
    fill: "#4B6D01",
    tint: "#EBF5DB",
    text: "#557003",
    tintDark: "#2C3813",
    textDark: "#90AF57",
  },
  green: {
    fill: "#037233",
    tint: "#E0F7E4",
    text: "#047735",
    tintDark: "#193B22",
    textDark: "#65B678",
  },
  teal: {
    fill: "#006F66",
    tint: "#D7F8F3",
    text: "#04746B",
    tintDark: "#013C37",
    textDark: "#1DB9AA",
  },
  cyan: {
    fill: "#016B8C",
    tint: "#DEF5FE",
    text: "#01708F",
    tintDark: "#01394A",
    textDark: "#35B1DA",
  },
  blue: {
    fill: "#255DCA",
    tint: "#E8F1FF",
    text: "#2264C1",
    tintDark: "#1F3351",
    textDark: "#73A4ED",
  },
  indigo: {
    fill: "#5E51C9",
    tint: "#EDEFFF",
    text: "#5B59C3",
    tintDark: "#2D2F51",
    textDark: "#959BED",
  },
  violet: {
    fill: "#883FBB",
    tint: "#F4ECFE",
    text: "#834AB8",
    tintDark: "#3A2A4B",
    textDark: "#B690E1",
  },
  magenta: {
    fill: "#AA2E8F",
    tint: "#FEE9F9",
    text: "#A73895",
    tintDark: "#45263F",
    textDark: "#D387C2",
  },
  slate: {
    fill: "#4D657F",
    tint: "#E9F1FA",
    text: "#506982",
    tintDark: "#29343F",
    textDark: "#8BA6C1",
  },
} as const;

export type SubjectSlot = keyof typeof subject;

// Nunito for everything we draw (D47); native chrome keeps the system font. Native registers the font
// under this name, and `Theme.fontFamily` maps it to the web font stack.
export const fontFamily = "Nunito";

// Nunito's digits are tabular by default (every figure is 600 units wide), so times and grades line
// up without a feature flag. `ios` is the Dynamic Type ramp passed as `dynamicTypeRamp`; Android
// scales `sp` by itself.
export const type = {
  display: { size: 34, line: 41, weight: "800", ios: "largeTitle" },
  title1: { size: 28, line: 34, weight: "800", ios: "title1" },
  title2: { size: 22, line: 28, weight: "800", ios: "title2" },
  title3: { size: 20, line: 26, weight: "700", ios: "title3" },
  headline: { size: 17, line: 22, weight: "800", ios: "headline" },
  body: { size: 17, line: 24, weight: "500", ios: "body" },
  callout: { size: 16, line: 22, weight: "500", ios: "callout" },
  subhead: { size: 15, line: 20, weight: "600", ios: "subheadline" },
  footnote: { size: 13, line: 18, weight: "700", ios: "footnote" },
  // Week grid cells only.
  caption: { size: 12, line: 16, weight: "800", ios: "caption1", maxScale: 1.3 },
  figure: { size: 34, line: 38, weight: "800", ios: "largeTitle" },
} as const;

export const space = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;

export const layout = {
  gutter: 16,
  cardPadding: 20,
  // The larger of Apple's 44 pt and Android's 48 dp, on every platform.
  minTarget: 48,
  wideBreakpoint: 768,
  contentMaxWidth: 720,
  weekGridListAtFontScale: 1.35,
} as const;

// Nested shapes subtract the padding: a card of 28 with padding 8 holds an inner shape of 20.
export const radius = { cell: 10, field: 16, tile: 20, card: 28, panel: 36, pill: 999 } as const;

// React Native 0.88 `boxShadow` strings, identical on iOS, Android and the web.
const elevationLight = {
  card: "0 6px 16px rgba(32, 55, 85, 0.08)",
  raised: "0 18px 48px rgba(32, 55, 85, 0.12)",
  float: "0 10px 30px rgba(32, 55, 85, 0.16)",
} as const;

export type ElevationName = keyof typeof elevationLight;

export const elevation = {
  light: elevationLight,
  dark: {
    card: "none",
    raised: "none",
    float: "0 10px 30px rgba(0, 0, 0, 0.5)",
  } satisfies Record<ElevationName, string>,
} as const;

// Reanimated 4 `withSpring({ duration, dampingRatio })`; the web uses the same durations in CSS.
export const motion = {
  press: { scale: 0.97, duration: 90 },
  spring: {
    standard: { duration: 350, dampingRatio: 0.9 },
    lively: { duration: 500, dampingRatio: 0.6 },
  },
  fade: { duration: 160 },
  stagger: 30,
} as const;

// The haptic each moment uses. The web has none.
export const haptic = {
  homeworkDone: "impactLight",
  signatureSaved: "notificationSuccess",
  commandRefused: "notificationWarning",
  pickerStep: "selection",
} as const;
