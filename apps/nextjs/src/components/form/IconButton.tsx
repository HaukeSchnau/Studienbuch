import type { Route } from "next";
import Link from "next/link";
import clsx from "clsx";

import type { IconName } from "../layout/icon";

type Props<TUrl extends string> = {
  icon: IconName;
  className?: string;
  size?: "sm" | "md" | "lg";
} & (
  | {
      onClick: () => void;
      href?: never;
    }
  | {
      href: Route<TUrl>;
      onClick?: never;
    }
);

export const IconButton = <TUrl extends string>({
  icon,
  onClick,
  href,
  className,
  size = "md",
}: Props<TUrl>) => {
  const classes = clsx(
    "rounded-full bg-transparent transition-colors hover:bg-black-80 grid place-items-center",
    className,
    size === "sm" && "h-6 w-6",
    size === "md" && "h-8 w-8",
    size === "lg" && "h-12 w-12",
  );

  const content = (
    <i
      className={clsx(
        size === "sm" && "text-sm",
        size === "md" && "text-lg",
        size === "lg" && "text-2xl",
      )}
    >
      {icon}
    </i>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={classes}>
        {content}
      </button>
    );
  }

  return (
    <Link href={href} className={classes}>
      {content}
    </Link>
  );
};
