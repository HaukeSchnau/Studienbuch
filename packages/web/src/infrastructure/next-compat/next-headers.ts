type CookieValue = string | { name: string; value: string };

export interface CookieStoreCompat {
  delete: (name: string) => void;
  get: (name: string) => { name: string; value: string } | undefined;
  set(name: string, value: string): void;
  set(cookie: { name: string; value: string }): void;
}

const serverCookies = new Map<string, string>();

const parseCookieString = (cookie: string): Map<string, string> => {
  const parsed = new Map<string, string>();

  for (const part of cookie.split(";")) {
    const trimmed = part.trim();
    if (!trimmed) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const name = decodeURIComponent(trimmed.slice(0, separatorIndex).trim());
    const value = decodeURIComponent(trimmed.slice(separatorIndex + 1).trim());
    parsed.set(name, value);
  }

  return parsed;
};

const serializeCookie = (name: string, value: string) =>
  `${encodeURIComponent(name)}=${encodeURIComponent(value)}; path=/`;

const resolveCookieValue = (nameOrCookie: CookieValue, maybeValue?: string) => {
  if (typeof nameOrCookie === "string") {
    return { name: nameOrCookie, value: maybeValue ?? "" };
  }

  return nameOrCookie;
};

export const headers = async (): Promise<Headers> => {
  if (typeof window === "undefined") {
    const cookieHeader = [...serverCookies.entries()]
      .map(([name, value]) => `${encodeURIComponent(name)}=${encodeURIComponent(value)}`)
      .join("; ");
    return new Headers(cookieHeader ? { cookie: cookieHeader } : undefined);
  }

  return new Headers(document.cookie ? { cookie: document.cookie } : undefined);
};

export const cookies = async (): Promise<CookieStoreCompat> => {
  const browserStore = typeof window === "undefined" ? null : parseCookieString(document.cookie);

  const getFromStore = (name: string) => {
    const value = browserStore ? browserStore.get(name) : serverCookies.get(name);
    if (typeof value === "undefined") {
      return undefined;
    }

    return {
      name,
      value,
    };
  };

  const setCookie: CookieStoreCompat["set"] = (nameOrCookie: CookieValue, maybeValue?: string) => {
    const { name, value } = resolveCookieValue(nameOrCookie, maybeValue);

    if (browserStore) {
      browserStore.set(name, value);
      document.cookie = serializeCookie(name, value);
      return;
    }

    serverCookies.set(name, value);
  };

  const deleteCookie = (name: string) => {
    if (browserStore) {
      browserStore.delete(name);
      document.cookie = `${encodeURIComponent(name)}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
      return;
    }

    serverCookies.delete(name);
  };

  return {
    delete: deleteCookie,
    get: getFromStore,
    set: setCookie,
  };
};
