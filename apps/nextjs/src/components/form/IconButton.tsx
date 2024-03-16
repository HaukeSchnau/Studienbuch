import clsx from "clsx";

import type { IconName } from "../layout/icon";

export const IconButton = ({
  icon,
  onClick,
  className,
  size = "md",
}: {
  icon: IconName;
  onClick: () => void;
  className?: string;
  size?: "sm" | "md" | "lg";
}) => (
  <button
    type="button"
    onClick={onClick}
    className={clsx(
      "rounded-full bg-transparent transition-colors hover:bg-black-80",
      className,
      size === "sm" && "h-6 w-6",
      size === "md" && "h-8 w-8",
      size === "lg" && "h-12 w-12",
    )}
  >
    <i
      className={clsx(
        size === "sm" && "text-sm",
        size === "md" && "text-lg",
        size === "lg" && "text-2xl",
      )}
    >
      {icon}
    </i>
  </button>
);
