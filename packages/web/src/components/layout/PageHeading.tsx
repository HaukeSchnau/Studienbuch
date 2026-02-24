import clsx from "clsx";
import type { ReactNode } from "react";

interface PageHeadingProps {
  children: ReactNode;
  color?: "green" | "white";
}

export const PageHeading = ({ children, color = "green" }: PageHeadingProps) => {
  return (
    <h1
      className={clsx("text-5xl font-semibold", {
        "text-white": color === "white",
        "text-primary-text": color === "green",
      })}
    >
      {children}
    </h1>
  );
};
