import { redirect as tanstackRedirect, useNavigate, useParams as useRouteParams, useRouterState } from "@tanstack/react-router";

type NavigationTarget = string | URL;

type RouterCompat = {
  back: () => void;
  forward: () => void;
  prefetch: (_href: NavigationTarget) => Promise<void>;
  push: (href: NavigationTarget) => void;
  refresh: () => void;
  replace: (href: NavigationTarget) => void;
};

const normalizeHref = (href: NavigationTarget) => (typeof href === "string" ? href : href.toString());

export const usePathname = () => useRouterState({ select: (state) => state.location.pathname });

export const useSearchParams = () => {
  const search = useRouterState({ select: (state) => state.location.search.str });
  return new URLSearchParams(search);
};

export const useParams = <T extends Record<string, string | string[] | undefined> = Record<string, string>>() => {
  return useRouteParams({ strict: false }) as T;
};

export const useRouter = (): RouterCompat => {
  const navigate = useNavigate({ from: "__root__" });

  return {
    back: () => {
      window.history.back();
    },
    forward: () => {
      window.history.forward();
    },
    prefetch: async () => {},
    push: (href: NavigationTarget) => {
      void navigate({ to: normalizeHref(href) as never });
    },
    refresh: () => {
      window.location.reload();
    },
    replace: (href: NavigationTarget) => {
      void navigate({ to: normalizeHref(href) as never, replace: true });
    },
  };
};

export const redirect = (href: NavigationTarget): never => {
  const normalized = normalizeHref(href);
  if (/^https?:\/\//.test(normalized)) {
    throw tanstackRedirect({ href: normalized });
  }
  throw tanstackRedirect({ to: normalized as never });
};
