import clsx from "clsx";

interface CardProps {
  children: React.ReactNode;
  noPadding?: boolean;
  className?: string;
}

export const Card = ({ children, className, noPadding }: CardProps) => {
  return (
    <div
      className={clsx("rounded-3xl bg-white shadow-md", className, {
        "p-4": !noPadding,
      })}
    >
      {children}
    </div>
  );
};

interface CardHeadingProps {
  children: React.ReactNode;
}

export const CardHeading = ({ children }: CardHeadingProps) => {
  return <h2 className="text-green mb-4 text-2xl font-bold">{children}</h2>;
};
