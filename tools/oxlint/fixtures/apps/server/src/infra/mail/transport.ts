// infra/ sits below the server's domain directories and imports none of them.

// oxlint-disable-next-line studienbuch/import-boundaries -- fixture: infra imports a route
export { minted } from "../../routes/demo-leak.ts";

// oxlint-disable-next-line studienbuch/import-boundaries -- fixture: infra imports the entry point
export { channel } from "../../notify.ts";
