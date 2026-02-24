import { useMemo, useSyncExternalStore } from "react";

type QueryParamValue = string | string[];
type Query = Record<string, QueryParamValue>;

type UrlObject = {
  hash?: string;
  pathname?: string;
  query?: Record<string, QueryParamValue | number | boolean | undefined>;
};

type UrlInput = string | URL | UrlObject;

export interface NextRouterCompat {
  asPath: string;
  pathname: string;
  push: (url: UrlInput) => Promise<boolean>;
  query: Query;
  replace: (url: UrlInput) => Promise<boolean>;
}

const subscribe = (onStoreChange: () => void) => {
  if (typeof window === "undefined") {
    return () => {};
  }

  window.addEventListener("popstate", onStoreChange);
  window.addEventListener("hashchange", onStoreChange);

  return () => {
    window.removeEventListener("popstate", onStoreChange);
    window.removeEventListener("hashchange", onStoreChange);
  };
};

const getSnapshot = () => (typeof window === "undefined" ? "http://localhost/" : window.location.href);
const getServerSnapshot = () => "http://localhost/";

const parseQuery = (searchParams: URLSearchParams): Query => {
  const query: Query = {};

  for (const [key, value] of searchParams.entries()) {
    const current = query[key];
    if (typeof current === "undefined") {
      query[key] = value;
      continue;
    }

    query[key] = Array.isArray(current) ? [...current, value] : [current, value];
  }

  return query;
};

const toHref = (input: UrlInput): string => {
  if (typeof input === "string") {
    return input;
  }

  if (input instanceof URL) {
    return input.toString();
  }

  const pathname = input.pathname ?? "/";
  const params = new URLSearchParams();

  for (const [key, rawValue] of Object.entries(input.query ?? {})) {
    if (typeof rawValue === "undefined") {
      continue;
    }

    if (Array.isArray(rawValue)) {
      for (const value of rawValue) {
        params.append(key, String(value));
      }
      continue;
    }

    params.set(key, String(rawValue));
  }

  const search = params.toString();
  const hash = input.hash ? `#${input.hash.replace(/^#/, "")}` : "";

  return `${pathname}${search ? `?${search}` : ""}${hash}`;
};

const navigateTo = (input: UrlInput, replace: boolean) => {
  if (typeof window === "undefined") {
    return;
  }

  const url = new URL(toHref(input), window.location.origin);
  if (replace) {
    window.history.replaceState(null, "", url);
  } else {
    window.history.pushState(null, "", url);
  }
  window.dispatchEvent(new PopStateEvent("popstate"));
};

export const useRouter = (): NextRouterCompat => {
  const href = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return useMemo(() => {
    const url = new URL(href);

    return {
      asPath: `${url.pathname}${url.search}${url.hash}`,
      pathname: url.pathname,
      push: async (input: UrlInput) => {
        navigateTo(input, false);
        return true;
      },
      query: parseQuery(url.searchParams),
      replace: async (input: UrlInput) => {
        navigateTo(input, true);
        return true;
      },
    };
  }, [href]);
};
