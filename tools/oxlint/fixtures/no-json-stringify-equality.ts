const before = { id: "a", title: "Mathe" };
const after = { title: "Mathe", id: "a" };

// oxlint-disable-next-line studienbuch/no-json-stringify-equality -- fixture: equal values, unequal JSON text
export const same = JSON.stringify(before) === JSON.stringify(after);

export const changed = (left: typeof before, right: typeof after) =>
  // oxlint-disable-next-line studienbuch/no-json-stringify-equality -- fixture: a changed check by JSON text
  JSON.stringify(left) !== JSON.stringify(right);

// A key built from JSON text, and one value's text checked against a literal, pass.
export const key = JSON.stringify(["space", "id"]);
export const empty = JSON.stringify(before) === "{}";
