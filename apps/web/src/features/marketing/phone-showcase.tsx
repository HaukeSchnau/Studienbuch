import { cn } from "#/ui/cn.ts";

/**
 * Production screenshots in a plain device frame. They come from the live App Store listing, so
 * they show the Flutter app this rewrite supersedes — replace `public/screenshots/*` once the new
 * client has equivalent surfaces.
 */
const screens = [
  {
    alt: "Die Übersicht zeigt den heutigen Stundenplan und offene Fehlzeiten.",
    src: "/screenshots/overview.png",
  },
  { alt: "Der Wochenplan zeigt alle Stunden einer Kalenderwoche.", src: "/screenshots/week.png" },
  { alt: "Die Kursseite zeigt mündliche und schriftliche Noten.", src: "/screenshots/grades.png" },
] as const;

const Phone = ({ alt, className, src }: { alt: string; className?: string; src: string }) => (
  <div
    className={cn(
      "overflow-hidden rounded-[2rem] bg-black p-1.5 shadow-card-lg ring-1 ring-black/10",
      className,
    )}
  >
    <img alt={alt} className="block w-full rounded-[1.6rem]" height={696} src={src} width={392} />
  </div>
);

/**
 * Three phones, the middle one lifted. Below `sm` only the middle screen is shown — the fan needs
 * width to read as anything other than clutter.
 */
export const PhoneShowcase = ({ className }: { className?: string }) => (
  <div className={cn("flex items-end justify-center gap-4 sm:gap-6", className)}>
    <Phone
      alt={screens[1].alt}
      className="hidden w-40 -rotate-3 sm:block md:w-52 lg:w-56"
      src={screens[1].src}
    />
    <Phone alt={screens[0].alt} className="w-60 sm:w-56 md:w-64 lg:w-72" src={screens[0].src} />
    <Phone
      alt={screens[2].alt}
      className="hidden w-40 rotate-3 sm:block md:w-52 lg:w-56"
      src={screens[2].src}
    />
  </div>
);
