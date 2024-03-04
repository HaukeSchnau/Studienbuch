import type { Metadata, NextPage } from "next";
import clsx from "clsx";

import styles from "./home.module.css";

export const metadata: Metadata = {
  alternates: {
    canonical: "/",
  },
};

const Home: NextPage = () => {
  return (
    <div className={clsx("mx-12 py-12 md:mx-[10vw] md:py-0", styles.main)}>
      <div
        className="flex items-center justify-around md:items-end"
        style={{
          gridArea: "headline",
        }}
      >
        <img
          src="/assets/icon.png"
          alt="IGS Lilienthal Logo"
          className="aspect-square w-[25vw] rounded-3xl md:w-48"
        />
        <h1 className="ml-4 flex-grow text-4xl font-bold leading-relaxed text-green md:ml-12 md:text-6xl md:leading-relaxed">
          Das Digitale <br /> Studienbuch
        </h1>
      </div>

      <div className="relative mt-12" style={{ gridArea: "showcase" }}>
        <img
          src="/assets/showcase.png"
          alt="Screenshots"
          className="relative -right-12 w-full"
        />
      </div>

      <div className="mt-12 md:mt-0" style={{ gridArea: "download" }}>
        <div className="text-lg md:text-3xl">
          Jeztzt als Download für Android und iOS:
        </div>
        <div className="mt-4 flex h-12 items-center md:mt-8 md:h-20">
          <a
            href="https://play.google.com/store/apps/details?id=de.haukeschnau.class_mate"
            target="_blank"
            rel="noreferrer"
            className="h-full"
          >
            <img
              src="/assets/google-play-badge.png"
              alt="Google Play Badge"
              className="h-full"
            />
          </a>
          <a
            href="https://apps.apple.com/app/igs-lilienthal/id6449227364 "
            target="_blank"
            rel="noreferrer"
            className="h-full"
          >
            <img
              src="/assets/app-store-badge.svg"
              alt="App Store Badge"
              className="ml-4 h-full"
            />
          </a>
        </div>
      </div>
    </div>
  );
};

export default Home;
