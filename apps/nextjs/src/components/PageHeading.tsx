import Head from "next/head";

interface PageHeadingProps {
  title: string;
}

export const PageHeading = ({ title }: PageHeadingProps) => {
  return (
    <>
      <Head>
        <title>{title}</title>
      </Head>
      <h1 className="text-5xl font-semibold text-white ">{title}</h1>
    </>
  );
};
