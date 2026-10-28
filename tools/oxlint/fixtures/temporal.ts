// oxlint-disable-next-line studienbuch/import-boundaries -- fixture: the global Temporal shim
export { Temporal } from "temporal-polyfill/global";

// The functional API passes.
export { compare } from "temporal-polyfill/fns/PlainDate";

// oxlint-disable-next-line eslint/no-restricted-globals -- fixture: the Temporal global
export const today = () => Temporal.Now.plainDateISO();
