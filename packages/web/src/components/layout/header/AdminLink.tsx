"use client";

import { api } from "~/infrastructure/trpc/react";
import { NavLink } from "../nav/NavLink";

export const AdminLink = () => {
  const { data: sessionData, isPending, isError, error } = api.auth.getSession.useQuery();

  if (isPending) {
    return null;
  }

  if (isError) {
    return <div>{error.message}</div>;
  }

  const isLoggedIn = !!sessionData?.user;

  if (!isLoggedIn) {
    return (
      <NavLink href="/login" icon="login">
        Anmelden
      </NavLink>
    );
  }

  return (
    <NavLink href="/admin" icon="admin_panel_settings">
      Admin
    </NavLink>
  );
};
