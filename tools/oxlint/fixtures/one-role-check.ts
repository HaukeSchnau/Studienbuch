declare const table: { readonly writableBy: { readonly [kind: string]: ReadonlyArray<string> } };

// oxlint-disable-next-line studienbuch/one-role-check -- fixture: a role check by hand
export const mayWrite = (role: string) => table.writableBy["notebook"]?.includes(role) === true;

// oxlint-disable-next-line studienbuch/one-role-check -- fixture: a destructured read
export const { writableBy } = table;

// Declaring who may write is the definition's job and stays allowed.
export const declared = { writableBy: { notebook: ["owner"] } };
