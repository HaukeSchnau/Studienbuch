/**
 * Runs before every test file. wa-sqlite's web build loads its wasm with `fetch`, and Node's `fetch`
 * rejects `file:` URLs, so Effect's wasm client can't start in Node as shipped. Remove this once
 * `makeMemory` accepts the wasm bytes or a `locateFile`, the same upstream change the app's OPFS
 * worker needs.
 */
import * as NodeFSP from "node:fs/promises";

const nodeFetch = globalThis.fetch;

globalThis.fetch = (input, init) => {
  const url = new URL(input instanceof Request ? input.url : input);

  if (url.protocol !== "file:") return nodeFetch(input, init);

  return NodeFSP.readFile(url).then(
    (bytes) => new Response(bytes, { headers: { "content-type": "application/wasm" } }),
  );
};
