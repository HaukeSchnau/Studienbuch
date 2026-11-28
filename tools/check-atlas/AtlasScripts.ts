// The atlas draws every box and walkthrough from its inline script, so a dropped quote leaves the
// page blank while its paths still check out.
import * as NodeVM from "node:vm";

const SCRIPT = /<script>(?<body>[\s\S]*?)<\/script>/gu;

/**
 * Each `<script>` that doesn't compile as a classic script, as "line N: message" with N the line
 * in `html`, or "no <script> found" when the declaration changed and nothing could be checked.
 * Compiling runs nothing.
 */
export function unparsable(html: string): ReadonlyArray<string> {
  const scripts = [...html.matchAll(SCRIPT)];

  if (scripts.length === 0) return ["no <script> found"];

  return scripts.flatMap((match) => {
    const body = match.groups?.["body"] ?? "";

    // The body starts on the line of its opening tag.
    const start = html.slice(0, match.index).split("\n").length;
    const compiled = compile(body, start - 1);

    if (!(compiled instanceof Error)) return [];
    const line = /^atlas:(?<line>\d+)$/mu.exec(compiled.stack ?? "")?.groups?.line;

    return [`line ${line ?? start}: ${String(compiled)}`];
  });
}

/** The compiled script, or the error that compiling it threw. */
function compile(body: string, lineOffset: number) {
  try {
    return new NodeVM.Script(body, { filename: "atlas", lineOffset });
  } catch (error) {
    return error instanceof Error ? error : new Error(String(error));
  }
}

export * as AtlasScripts from "./AtlasScripts.ts";
