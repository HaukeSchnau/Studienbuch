type StorageModule = typeof import("./storage");

declare const require: (path: string) => unknown;

const getSessionToken = () => {
  const storageModule = require("./storage") as StorageModule;
  return storageModule.getStorage("auth.session")?.token;
};

export const buildHeaders = (sessionToken?: string) => {
  const headers = new Map<string, string>();
  headers.set("x-trpc-source", "expo-react");
  if (sessionToken) headers.set("x-session", sessionToken);

  return headers;
};

export const getHeaders = () => {
  return buildHeaders(getSessionToken());
};

export const getHeadersObject = () => {
  const headsMap = getHeaders();
  return Object.fromEntries(headsMap);
};
