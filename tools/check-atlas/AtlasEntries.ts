// Each box's entry in the atlas's INFO map is one line. Git and jj both report a conflict when two
// branches change neighbouring lines, so a blank line between entries lets two branches change two
// boxes and still merge.
const INFO = /^const INFO = \{$(?<body>[\s\S]*?)^\};$/mu;
const ENTRY = /^ {2}(?<key>"[^"]+"|[\w$]+): \{/u;

/**
 * The INFO entries that sit on the line right below another entry, as "key, below other", or
 * "INFO map not found" when the map's declaration changed and nothing could be checked.
 */
export function crowded(html: string): ReadonlyArray<string> {
  const body = INFO.exec(html)?.groups?.body;

  if (body === undefined) return ["INFO map not found"];
  const lines = body.split("\n");

  return lines.flatMap((line, index) => {
    const key = ENTRY.exec(line)?.groups?.key;
    const above = index > 0 ? ENTRY.exec(lines[index - 1] ?? "")?.groups?.key : undefined;

    return key !== undefined && above !== undefined ? [`${key}, below ${above}`] : [];
  });
}

export * as AtlasEntries from "./AtlasEntries.ts";
