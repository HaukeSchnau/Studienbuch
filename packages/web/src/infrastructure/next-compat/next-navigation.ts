import { useMemo, useSyncExternalStore } from "react";

type NavigationTarget = string | URL;

type RouterCompat = {
  back: () => void;
  forward: () => void;
  prefetch: (_href: NavigationTarget) => Promise<void>;
  push: (href: NavigationTarget) => void;
  refresh: () => void;
  replace: (href: NavigationTarget) => void;
};

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

const toHref = (href: NavigationTarget) => (typeof href === "string" ? href : href.toString());

const navigateTo = (href: NavigationTarget, replace: boolean) => {
  if (typeof window === "undefined") {
    return;
  }

  const nextUrl = new URL(toHref(href), window.location.origin);
  if (replace) {
    window.history.replaceState(null, "", nextUrl);
  } else {
    window.history.pushState(null, "", nextUrl);
  }
  window.dispatchEvent(new PopStateEvent("popstate"));
};

const useCurrentUrl = () => {
  const href = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return useMemo(() => new URL(href), [href]);
};

export const usePathname = () => {
  const url = useCurrentUrl();
  return url.pathname;
};

export const useSearchParams = () => {
  const url = useCurrentUrl();
  return useMemo(() => new URLSearchParams(url.searchParams), [url]);
};

export const useParams = <T extends Record<string, string | string[] | undefined> = Record<string, string>>() => {
  return {} as T;
};

export const useRouter = (): RouterCompat => {
  return {
    back: () => {
      if (typeof window !== "undefined") {
        window.history.back();
      }
    },
    forward: () => {
      if (typeof window !== "undefined") {
        window.history.forward();
      }
    },
    prefetch: async () => {},
    push: (href: NavigationTarget) => {
      navigateTo(href, false);
    },
    refresh: () => {
      if (typeof window !== "undefined") {
        window.location.reload();
      }
    },
    replace: (href: NavigationTarget) => {
      navigateTo(href, true);
    },
  };
};

export const redirect = (href: NavigationTarget): never => {
  navigateTo(href, true);
  throw new Error(`NEXT_REDIRECT:${toHref(href)}`);
};
