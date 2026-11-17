// The fixtures' tsconfig resolves no import, so this types every import as `any`: a fixture checks
// what a rule sees in the syntax, and needs no declaration for the modules it imports.
declare module "*";

// The host's platform, which feature-code fixtures read. The base config's `"types": []` leaves
// out @types/node.
declare const process: {
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly platform: string;
};

// JSX in the .tsx fixtures, without React's types.
declare namespace JSX {
  interface Element {
    readonly props: Attributes;
  }

  type Child = string | number | boolean | Element | undefined;

  interface Attributes {
    readonly [attribute: string]: Child | ReadonlyArray<Child>;
  }

  type IntrinsicElements = Record<string, Attributes>;
}
