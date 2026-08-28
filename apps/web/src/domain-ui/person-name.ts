/**
 * How Studienbuch says someone's name back to them.
 *
 * The app this rewrite supersedes greets "Moin, {shortName}!" and builds initials the same way, so
 * these rules are copied from it rather than invented: a person who has used Studienbuch before
 * should be addressed by the web the way they are already addressed by the phone in their pocket.
 *
 * Both take the account's self-authored name. There is no
 * structure to rely on — someone may have typed one word, three, or a nickname — so neither rule
 * does more than take what is there.
 */

/** The name a greeting uses: what comes before the first space, and before any hyphen in it. */
export const shortName = (name: string) => {
  const first = name.trim().split(/\s+/)[0] ?? "";
  return first.split("-")[0] ?? "";
};

/** One or two letters for an avatar. First and last word, or the first two letters of one word. */
export const initials = (name: string) => {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  const first = words[0] ?? "";
  const last = words.at(-1) ?? "";
  return (
    words.length === 1 ? first.slice(0, 2) : first.slice(0, 1) + last.slice(0, 1)
  ).toLocaleUpperCase("de-DE");
};
