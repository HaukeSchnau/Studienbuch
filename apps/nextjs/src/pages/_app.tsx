import "../styles/globals.css";
import { type AppType } from "next/app";
import { useRouter } from "next/router";
import type { Session } from "next-auth";
import { SessionProvider } from "next-auth/react";

import { api } from "~/utils/api";
import AdminLayout from "~/layouts/admin";

const LayoutMap = {
  admin: AdminLayout,
} as const;

const MyApp: AppType<{ session: Session | null; url?: string }> = ({
  Component,
  pageProps: { session, ...pageProps },
}) => {
  const router = useRouter();
  const url = router.asPath.split("/")[1];

  const Layout =
    (url && LayoutMap[url as keyof typeof LayoutMap]) ||
    (({ children }) => <>{children}</>);

  return (
    <SessionProvider session={session}>
      <Layout>
        <Component {...pageProps} />
      </Layout>
    </SessionProvider>
  );
};

export default api.withTRPC(MyApp);
