import Link from "next/link";
import clsx from "clsx";

interface CardProps {
  children: React.ReactNode;
  noPadding?: boolean;
  className?: string;
  href?: string;
}

export const Card = ({ children, className, noPadding, href }: CardProps) => {
  const classes = clsx("rounded-3xl bg-white shadow-md", className, {
    "p-8": !noPadding,
  });

  if (href)
    return (
      <Link
        href={href}
        className={clsx(
          classes,
          "transition-all hover:-rotate-3 hover:scale-110",
        )}
      >
        {children}
      </Link>
    );

  return <div className={classes}>{children}</div>;
};

interface CardHeadingProps {
  children: React.ReactNode;
}

export const CardHeading = ({ children }: CardHeadingProps) => {
  return <h2 className="mb-4 text-2xl font-bold text-green">{children}</h2>;
};
