import { type GetServerSideProps } from "next";

export default function AdminPage() {
  return <></>;
}

export const getServerSideProps: GetServerSideProps = async (_) => {
  return {
    redirect: {
      destination: "/admin/schedules",
      permanent: true,
    },
  };
};
