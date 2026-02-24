export const api: any = new Proxy(
  {},
  {
    get: () => api,
    apply: () => api,
  },
);

export const HydrateClient = (props: { children: unknown }) => props.children;
