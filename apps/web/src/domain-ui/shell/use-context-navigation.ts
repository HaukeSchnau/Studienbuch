import type { Organization } from "@stu/core/organization";
import { useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";
import { contextParams, landingDestination } from "./destinations.ts";

/**
 * Goes to where a context opens.
 *
 * Its first destination rather than the current one carried across: there is no reason to think a
 * teacher's "Meine Kurse" has a counterpart in the operator context, and guessing at one produces
 * links that lead nowhere. Switching context is arriving somewhere new, not the same place wearing
 * a different hat.
 */
export const useContextNavigation = () => {
  const navigate = useNavigate();

  return useCallback(
    (context: Organization.ContextRef, options?: { readonly replace?: boolean }) => {
      const destination = landingDestination(context);
      if (destination === undefined) return;
      const replace = options?.replace ?? false;

      if (destination.placement === "school") {
        const params = contextParams(context);
        if (params === undefined) return;
        void navigate({ to: destination.to, params, replace });
        return;
      }
      void navigate({ to: destination.to, replace });
    },
    [navigate],
  );
};
