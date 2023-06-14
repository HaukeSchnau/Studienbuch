import NavigationItem, { LogoutButton } from "~/components/NavigationItem";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="bg-offwhite bg-main-blob flex h-screen overflow-hidden bg-contain bg-no-repeat">
      <div className="w-80 rounded-r-3xl bg-white p-4 shadow-md">
        <img
          src="/assets/icon.png"
          className="rounded-full p-12"
          alt="IGS Lilienthal Logo"
        />
        <ul className="flex flex-col gap-2">
          <NavigationItem href="/admin/schedules">Stundenpläne</NavigationItem>
          <NavigationItem href="/admin/substitutions">
            Vertretungspläne
          </NavigationItem>
          <NavigationItem href="/admin/courses">Kurse</NavigationItem>
          <NavigationItem href="/admin/classes">Klasen</NavigationItem>
          <LogoutButton />
        </ul>
      </div>
      <div className="flex-1 overflow-y-auto px-16 py-12">{children}</div>
    </div>
  );
}
