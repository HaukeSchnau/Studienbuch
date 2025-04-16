import type { ReactNode } from "react";
import { Fragment, useId, useLayoutEffect } from "react";
import { create } from "zustand";

interface PortalStore {
  portals: Record<string, ReactNode | undefined>;
  setPortal: (id: string, portal: ReactNode) => void;
}

export const usePortalStore = create<PortalStore>((set) => ({
  portals: {},
  setPortal: (id: string, portal: ReactNode) =>
    set((state) => ({ ...state, portals: { ...state.portals, [id]: portal } })),
}));

export const Portal = ({ children }: { children: ReactNode }): ReactNode => {
  const id = useId();
  const setPortal = usePortalStore((store) => store.setPortal);

  useLayoutEffect(() => {
    setPortal(id, children);

    return () => {
      setPortal(id, undefined);
    };
  });

  return null;
};

export const PortalRenderer = (): ReactNode => {
  const portals = usePortalStore((state) => state.portals);

  return Object.entries(portals).map(([id, portal]) => (
    <Fragment key={id}>{portal}</Fragment>
  ));
};
