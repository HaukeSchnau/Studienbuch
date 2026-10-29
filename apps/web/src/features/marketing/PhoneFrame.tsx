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
 * A frameless phone around a live 390-point screen, scaled by `zoom` on the device (`--phone-zoom`)
 * while the figure carries position and rotation, which zoom would distort. Status and tab bar are
 * device chrome drawn here; in the app the operating system draws them (variant B).
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
            <svg className="phone-status-icons" viewBox="0 0 66 14">
              <path d="M1 13h3V9H1zM6 13h3V6.5H6zM11 13h3V4h-3zM16 13h3V1.5h-3z" />
              <path
                className="phone-status-wifi"
                d="M26 5.2a10 10 0 0 1 13 0M28.4 8a6.2 6.2 0 0 1 8.2 0M30.8 10.8a2.4 2.4 0 0 1 3.4 0"
              />
              <rect height="11" rx="3" width="21" x="43" y="1.5" />
            </svg>
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
