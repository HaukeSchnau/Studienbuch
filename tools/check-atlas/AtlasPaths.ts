// The atlas renders its file links at runtime from the base URL plus the paths in its data: `f`
// lists a box's main files, `where` a walkthrough step's, `a` a box's ADR numbers, and `ADR` maps
// numbers to file names.
// Hand-written links and `<code>` paths sit in the markup.
const LINK = /\/src\/branch\/main\/(?<path>[^"'`<>\s#?$]+)/gu;
const FILE_LIST = /\b(?:f|where): \[(?<list>(?:\s*"[^"]*",?)*\s*)\]/gu;
const ADR_MAP = /\bconst ADR = \{(?<map>[^}]*)\}/u;
const ADR_ENTRY = /(?<number>\d+): "/gu;
const ADR_LIST = /\ba: \[(?<list>[\d,\s]*)\]/gu;
const NUMBER = /\d+/gu;
const STRING = /"(?<value>[^"]*)"/gu;
const CODE = /<code>(?<path>[^<]*)<\/code>/gu;

// A `<code>` span names a path when it starts with one of these, rather than a type or a route.
const REPOSITORY_PATH = /^(?:apps|packages|tools|docs|deploy|nix|\.calder)\/[\w.@()[\]/-]*$/u;

const strings = (text: string) =>
  [...text.matchAll(STRING)].flatMap((match) => match.groups?.value ?? []);

/** Every repository path the atlas links to or names in a `<code>` span, sorted and unique. */
export function referenced(html: string): ReadonlyArray<string> {
  const links = [...html.matchAll(LINK)].flatMap((match) => match.groups?.path ?? []);
  const lists = [...html.matchAll(FILE_LIST)].flatMap((match) => strings(match.groups?.list ?? ""));
  const adrs = strings(ADR_MAP.exec(html)?.groups?.map ?? "").map((name) => `docs/adr/${name}.md`);

  const code = [...html.matchAll(CODE)]
    .flatMap((match) => match.groups?.path ?? [])
    .filter((path) => REPOSITORY_PATH.test(path));

  return [...new Set([...links, ...lists, ...adrs, ...code])].sort();
}

/** The ADR numbers boxes cite that the ADR map has no file name for, sorted and unique. */
function unmappedAdrs(html: string): ReadonlyArray<string> {
  const map = ADR_MAP.exec(html)?.groups?.map ?? "";
  const mapped = new Set([...map.matchAll(ADR_ENTRY)].map((match) => match.groups?.number));

  const cited = [...html.matchAll(ADR_LIST)].flatMap((match) =>
    [...(match.groups?.list ?? "").matchAll(NUMBER)].map(([n]) => n),
  );

  return [...new Set(cited)].filter((n) => !mapped.has(n)).sort((a, b) => Number(a) - Number(b));
}

/** The paths the atlas names that `exists` doesn't find, then the ADR numbers it can't link. */
export function missing(html: string, exists: (path: string) => boolean): ReadonlyArray<string> {
  return [
    ...referenced(html).filter((path) => !exists(path)),
    ...unmappedAdrs(html).map((n) => `ADR ${n}, which the ADR map lacks`),
  ];
}

export * as AtlasPaths from "./AtlasPaths.ts";
