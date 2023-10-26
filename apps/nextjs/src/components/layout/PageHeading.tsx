import Head from "next/head";
import clsx from "clsx";

interface PageHeadingProps {
  title: string;
  color: "green" | "white";
}

export const PageHeading = ({ title, color }: PageHeadingProps) => {
  return (
    <>
      <Head>
        <title>{title}</title>
      </Head>
      <h1
        className={clsx("text-5xl font-semibold", {
          "text-white": color === "white",
          "text-green": color === "green",
        })}
      >
        {title}
      </h1>
    </>
  );
};
