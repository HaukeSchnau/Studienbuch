import type { AnchorHTMLAttributes, ReactNode } from "react";
import { Link as RouterLink } from "@tanstack/react-router";

type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  href: string | URL;
  children?: ReactNode;
};

export default function Link({ href, children, ...props }: LinkProps) {
  const normalizedHref = typeof href === "string" ? href : href.toString();
  const isExternal = /^https?:\/\//.test(normalizedHref) || normalizedHref.startsWith("mailto:");

  if (isExternal || props.target === "_blank") {
    return (
      <a href={normalizedHref} {...props}>
        {children}
      </a>
    );
  }

  return (
    <RouterLink to={normalizedHref} {...props}>
      {children}
    </RouterLink>
  );
}
