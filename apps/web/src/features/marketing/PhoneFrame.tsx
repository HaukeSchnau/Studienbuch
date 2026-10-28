import type { ReactNode } from "react";

import { Demo } from "./Demo.ts";

type Tab = "today" | "week";

const tabs = [
  {
    id: "today",
    label: "Übersicht",
    icon: "M4 11.5 12 5l8 6.5V20a1 1 0 0 1-1 1h-4.5v-5.5h-5V21H5a1 1 0 0 1-1-1z",
  },
  {
    id: "week",
    label: "Meine Woche",
    icon: "M6 5h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM4 10h16M8 3v4M16 3v4",
  },
  {
    id: "profile",
    label: "Mein Profil",
    icon: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20.5c1.2-3.6 4-5.5 7.5-5.5s6.3 1.9 7.5 5.5",
  },
] as const;

/**
 * A phone around a live app screen. The screen is laid out at 390 points, the width of the mocks,
 * and `zoom` on the device (landing.css, `--phone-zoom`) scales it to its placement. The figure
 * itself carries position and rotation, because zoom would scale its offsets too. Status bar and tab bar are
 * device chrome drawn here: in the app the operating system draws them (variant B).
 */
export function PhoneFrame({
  tab,
  label,
  className,
  children,
}: {
  tab: Tab;
  /** What the screen shows, for people who can't see it. */
  label: string;
  className: string;
  children: ReactNode;
}) {
  return (
    <figure aria-label={label} className={`phone ${className}`}>
      <div className="phone-device">
        <div className="phone-screen">
          <div aria-hidden className="phone-status">
            <span>{Demo.clock}</span>
            <span className="phone-island" />
            <span className="phone-battery" />
          </div>
          <div className="phone-content">{children}</div>
          <div aria-hidden className="phone-tabs">
            {tabs.map((each) => (
              <span className="phone-tab" data-active={each.id === tab} key={each.id}>
                <svg className="phone-tab-icon" viewBox="0 0 24 24">
                  <path d={each.icon} />
                </svg>
                {each.label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </figure>
  );
}
