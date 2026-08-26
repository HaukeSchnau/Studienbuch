import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { contextParams, type Destination } from "./destinations.ts";
import type { ShellContext } from "./contexts.ts";

/**
 * A link to a destination, in whichever route placement that destination belongs to.
 *
 * The branch is the price of type-safe routing and worth paying once here rather than at each of the
 * two navigation presentations. A school destination reached from the operator context has no
 * parameters to supply and simply does not render — which cannot happen, because capabilities keep
 * the two apart, but is the honest thing to do rather than assert.
 */
export const DestinationLink = ({
  children,
  className,
  context,
  destination,
}: {
  readonly children: ReactNode;
  readonly className: string;
  readonly context: ShellContext;
  readonly destination: Destination;
}) => {
  const shared = {
    activeProps: { "aria-current": "page" as const, "data-active": "true" },
    className,
    "data-testid": `main-${destination.id}`,
  };

  if (destination.placement === "school") {
    const params = contextParams(context.ref);
    if (params === undefined) return null;
    return (
      <Link {...shared} params={params} to={destination.to}>
        {children}
      </Link>
    );
  }

  return (
    <Link {...shared} to={destination.to}>
      {children}
    </Link>
  );
};
