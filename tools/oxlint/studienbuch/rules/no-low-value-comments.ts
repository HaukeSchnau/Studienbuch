import { defineRule, type Comment } from "@oxlint/plugins";

// Ported from T3 Code's rule of the same name (github.com/pingdotgg/t3code, MIT, copyright T3 Tools
// Inc.), without T3's `@public` boilerplate check. A closed fence around a usage example doesn't
// count toward the line limit, because AGENTS.md wants comments to show how a function is used.
// T3 skips a block that holds a directive; here only the directive drops out.

const DIRECTIVE =
  /^\s*(?:(?:oxlint|eslint)-|@ts-|@effect-diagnostics|prettier-ignore|biome-ignore|c8 |istanbul |#(?:end)?region)/u;

const DIVIDER_LINE = /^(?:[-=*#~_/+]{3,}.*|.*[-=*#~_]{3,})$/u;
const TEST_STEP = /^(?:arrange|act|assert|given|when|then)\s*[:.]?$/iu;
const TASK_MARKER = /\b(?:TODO|FIXME|XXX|HACK)\b/u;

// `quarantine: <why>` and `regression: #123` test markers exist to carry their text.
const TEST_MARKER = /^\s*(?:regression|quarantine):/u;
const TASK_LINK = /#\d+|https?:\/\//u;

// `owner/repo#123` names an outside tracker; a bare `#123` is our own history.
const BARE_ISSUE_REFERENCE = /(?<![\w/&#-])#[1-9]\d{2,4}(?![\w-])/u;
const CODE_SPAN = /`[^`]*`/gu;
const FENCE = /^```/u;

// Past this, the reason needs cutting, not more context.
const MAX_LINES = 4;
const LICENSE = /^!|@license|\bcopyright\b|\bSPDX-License-Identifier\b/iu;
const JSDOC_TYPE = /^@(?:param|returns?|type|typedef)\s+\{/u;
const EMPTY_JSDOC_TAG = /^@(?:param(?:\s+\[?[\w$.]+\]?)?|returns?)$/u;

const COMMENTED_CODE =
  /^(?:(?:(?:const|let|var)\s+[\w${}[\], ]+=.*|import\s.+\sfrom\s+["'].+["']|(?:await\s+|return\s+)?[\w$.]+\(.*\)|[\w$.[\]]+\s*=\s*.+);|(?:if|for|while|switch)\s*\(.*\)\s*\{|\}(?:\s*else\s*\{)?)$/u;

const DECLARATION =
  /^\s*(?:export\s+)?(?:default\s+)?(?:declare\s+)?(?:async\s+)?(?:static\s+)?(?:readonly\s+)?(?:(?:const|let|var|function\*?|class|interface|type|enum)\s+)?([A-Za-z_$][\w$]*)\s*[?!]?\s*[:=(<{]/u;

const FILLER_WORDS = new Set(
  "a an the of for to in on at by with from and or is are be this that it its as get set return create new current value given whether".split(
    " ",
  ),
);

const stem = (word: string) => (word.length > 3 ? word.replace(/([^s])s$/u, "$1") : word);

const words = (text: string) =>
  (text.toLowerCase().match(/[a-z0-9]+/gu) ?? [])
    .filter((word) => !FILLER_WORDS.has(word))
    .map(stem)
    .filter((word) => !FILLER_WORDS.has(word));

const identifierWords = (name: string) =>
  words(name.replace(/([a-z0-9])([A-Z])/gu, "$1 $2").replace(/([A-Z]+)([A-Z][a-z])/gu, "$1 $2"));

const linesOf = (comment: Comment) =>
  comment.value
    .split("\n")
    .map((line) => line.replace(/^\s*\*?\s?/u, "").trim())
    .filter((line) => line !== "");

/** The lines outside closed code fences. A fence that never closes hides nothing. */
function proseLines(lines: ReadonlyArray<string>): number {
  let count = 0;
  // The lines since a fence opened, the fence included, or null outside a fence.
  let fenced: number | null = null;

  for (const line of lines) {
    if (fenced === null) {
      if (FENCE.test(line)) fenced = 1;
      else count += 1;
    } else {
      fenced = FENCE.test(line) ? null : fenced + 1;
    }
  }

  return count + (fenced ?? 0);
}

/** Consecutive `//` lines at one indent read as one comment. */
function groupsOf(comments: ReadonlyArray<Comment>): Array<Array<Comment>> {
  const groups: Array<Array<Comment>> = [];

  for (const comment of comments) {
    const last = groups.at(-1);
    const previous = last?.at(-1);

    const continues =
      comment.type === "Line" &&
      previous?.type === "Line" &&
      previous.loc.end.line === comment.loc.start.line - 1 &&
      previous.loc.start.column === comment.loc.start.column;

    if (last !== undefined && continues) last.push(comment);
    else groups.push([comment]);
  }

  return groups;
}

/** A comment says why, or how a function is used. It never repeats the code or narrates tests. */
export default defineRule({
  meta: {
    type: "suggestion",
    docs: {
      description: "Reject comments that only repeat the code, divide sections, or narrate tests.",
    },
    messages: {
      divider:
        "Drop the section divider. Split the file, or let the code's structure show the grouping.",
      testStep: "Drop the test step label.",
      taskMarker: "Link the issue that tracks this, or drop the marker.",
      issueNumber: "Drop the PR or issue number, because the history records it. Keep the reason.",
      jsdocType: "Drop the JSDoc type. TypeScript already has it.",
      emptyJsdocTag: "Drop the JSDoc tag that has no description.",
      commentedCode: "Delete commented-out code. The history keeps it.",
      restatesName:
        "Drop the comment, because it only repeats the name below it. Say why, or say nothing.",
      tooLong: `Cut this to ${MAX_LINES} lines or fewer. Keep the constraint and drop the background.`,
    },
  },
  create(context) {
    const { sourceCode } = context;
    const isTypeScript = /\.[cm]?tsx?$/u.test(context.filename);

    const restatesNextName = (lastLine: number, lines: ReadonlyArray<string>) => {
      if (lines.some((line) => line.startsWith("@"))) return false;

      const name = DECLARATION.exec(sourceCode.lines[lastLine] ?? "")?.[1];

      if (name === undefined) return false;

      const content = words(lines.join(" "));

      if (content.length === 0 || content.length > 6) return false;

      const nameWords = new Set(identifierWords(name));

      return content.every((word) => nameWords.has(word));
    };

    const problem = (comments: ReadonlyArray<Comment>, lines: ReadonlyArray<string>) => {
      const text = comments.map((comment) => comment.value).join("\n");
      const first = comments[0];
      const last = comments.at(-1);

      if (first === undefined || last === undefined || lines.length === 0) return null;

      const isLine = first.type === "Line";

      if (lines.some((line) => DIVIDER_LINE.test(line))) return "divider";

      if (isLine && lines.length === 1 && TEST_STEP.test(lines[0] ?? "")) return "testStep";

      const hasTaskMarker = TASK_MARKER.test(text);

      if (hasTaskMarker && !TASK_LINK.test(text)) return "taskMarker";

      if (
        !hasTaskMarker &&
        !TEST_MARKER.test(text) &&
        BARE_ISSUE_REFERENCE.test(text.replace(CODE_SPAN, ""))
      ) {
        return "issueNumber";
      }

      if (isTypeScript && lines.some((line) => JSDOC_TYPE.test(line))) return "jsdocType";

      if (lines.some((line) => EMPTY_JSDOC_TAG.test(line))) return "emptyJsdocTag";

      if (isLine && lines.every((line) => COMMENTED_CODE.test(line))) return "commentedCode";

      if (restatesNextName(last.loc.end.line, lines)) return "restatesName";

      if (proseLines(lines) > MAX_LINES && !LICENSE.test(text)) return "tooLong";

      return null;
    };

    return {
      Program() {
        for (const group of groupsOf(sourceCode.getAllComments())) {
          const comments = group.filter((comment) => !DIRECTIVE.test(comment.value));
          const messageId = problem(comments, comments.flatMap(linesOf));
          const first = comments[0];
          const last = comments.at(-1);

          if (messageId === null || first === undefined || last === undefined) continue;

          context.report({ loc: { start: first.loc.start, end: last.loc.end }, messageId });
        }
      },
    };
  },
});
