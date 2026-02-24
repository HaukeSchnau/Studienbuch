import { useNavigate, useRouterState } from "@tanstack/react-router";

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

const normalizeSearch = (search: unknown): string => {
  if (typeof search === "string") {
    return search;
  }
  if (search && typeof search === "object" && "str" in search && typeof search.str === "string") {
    return search.str;
  }
  return "";
};

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
    return `${input.pathname}${input.search}${input.hash}`;
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

export const useRouter = (): NextRouterCompat => {
  const navigate = useNavigate();
  const location = useRouterState({ select: (state) => state.location });
  const search = normalizeSearch(location.search);

  return {
    asPath: `${location.pathname}${search}${location.hash}`,
    pathname: location.pathname,
    push: async (input: UrlInput) => {
      await navigate({ to: toHref(input) as never });
      return true;
    },
    query: parseQuery(new URLSearchParams(search)),
    replace: async (input: UrlInput) => {
      await navigate({ to: toHref(input) as never, replace: true });
      return true;
    },
  };
};
