// oxlint-disable-next-line studienbuch/no-baked-origin -- fixture: beta's origin in web code
export const beta = "https://beta.studienbuch.app/api/rpc";

export const local = (path: string) =>
  // oxlint-disable-next-line studienbuch/no-baked-origin -- fixture: a local server in web code
  `http://localhost:3000/${path}`;

// Relative URLs and other sites pass.
export const rpc = "/api/rpc";
export const webuntis = "https://webuntis.com";
