import { CourseScreen, OverviewScreen, PhoneFrame } from "#/domain-ui/app-preview/phone.tsx";
import { AppIcon } from "#/domain-ui/brand/wordmark.tsx";
import { StoreBadges } from "#/domain-ui/brand/store-badges.tsx";
import { sectionIds } from "#/domain-ui/brand/links.ts";
import { SiteFooter } from "#/domain-ui/site-footer.tsx";
import { SiteNav } from "#/domain-ui/site-nav.tsx";
import { copy } from "#/features/marketing/copy.ts";
import { BlueBlob, GreenBlob } from "#/features/marketing/variants/blobs/decor.tsx";

/**
 * Variant A, faithful.
 *
 * The legacy composition kept as it was: white page, two colour blobs bleeding out of opposite
 * corners, a pill nav in the top margin, and one oversized device running off the right edge. The
 * only real changes are that the blobs scale with the viewport instead of stepping between two
 * fixed sizes, and that the device is live markup rather than a screenshot.
 */
export const BlobsLanding = () => (
  <div className="relative isolate min-h-screen overflow-x-clip pt-4">
    <div aria-hidden className="absolute inset-0 -z-10 overflow-hidden">
      <BlueBlob />
      <GreenBlob />
    </div>

    <SiteNav />

    <main>
      {/* Hero. The device sits in its own grid column and is then pushed past the viewport edge, so
          it can be bigger than the space it is given without resizing the text column. */}
      <section className="mx-auto grid w-full max-w-6xl items-center gap-y-12 px-6 pt-16 pb-20 md:px-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-x-10">
        <div>
          <div className="flex items-center gap-5 sm:gap-8">
            <AppIcon className="w-24 shadow-card-lg sm:w-32 lg:w-40" />
            <h1 className="text-4xl/[1.25] text-primary-text sm:text-5xl/[1.25] lg:text-6xl/[1.2]">
              {copy.hero.headline[0]}
              <br />
              {copy.hero.headline[1]}
            </h1>
          </div>

          <p className="mt-8 max-w-lg text-lg/relaxed text-ink-soft text-pretty sm:text-xl/relaxed">
            {copy.hero.lead}
          </p>

          <p className="mt-10 text-xl text-ink sm:text-2xl">{copy.hero.downloadPrompt}</p>
          <StoreBadges className="mt-5" />
        </div>

        <div className="flex justify-center lg:translate-x-[12%]">
          <PhoneFrame className="[zoom:0.62] sm:[zoom:0.8] lg:[zoom:0.95]">
            <OverviewScreen />
          </PhoneFrame>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-6 py-20 md:px-10" id={sectionIds.features}>
        <h2 className="max-w-2xl text-3xl/tight text-primary-text sm:text-4xl/tight">
          {copy.features.title}
        </h2>
        <p className="mt-4 max-w-2xl text-lg/relaxed text-ink-soft text-pretty">
          {copy.features.lead}
        </p>

        <div className="mt-12 grid gap-12 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
          <dl className="grid gap-x-10 gap-y-8 sm:grid-cols-2">
            {copy.features.items.map(({ title, body }) => (
              <div className="reveal" key={title}>
                <dt className="text-xl font-bold text-primary-text">{title}</dt>
                <dd className="mt-2 text-base/relaxed text-ink-soft text-pretty">{body}</dd>
              </div>
            ))}
          </dl>

          <div className="flex justify-center">
            <PhoneFrame className="[zoom:0.6] lg:[zoom:0.72]">
              <CourseScreen />
            </PhoneFrame>
          </div>
        </div>
      </section>

      <section
        className="mx-auto w-full max-w-4xl px-6 py-20 text-center md:px-10"
        id={sectionIds.offline}
      >
        <h2 className="text-3xl/tight text-primary-text sm:text-4xl/tight">{copy.offline.title}</h2>
        <p className="mx-auto mt-5 max-w-2xl text-lg/relaxed text-ink-soft text-pretty sm:text-xl/relaxed">
          {copy.offline.body}
        </p>
      </section>

      <section
        className="mx-auto w-full max-w-4xl px-6 pt-4 pb-20 md:px-10"
        id={sectionIds.schools}
      >
        <div className="rounded-card-lg bg-primary-des p-8 sm:p-12">
          <h2 className="text-2xl text-primary-text sm:text-3xl">{copy.schools.title}</h2>
          <p className="mt-4 max-w-2xl text-lg/relaxed text-ink-soft text-pretty">
            {copy.schools.body}
          </p>
          <a
            className="mt-6 inline-flex rounded-full bg-primary px-6 py-3 font-bold text-white shadow-card transition-transform hover:scale-105"
            href={copy.schools.href}
          >
            {copy.schools.cta}
          </a>
        </div>
      </section>
    </main>

    <SiteFooter />
  </div>
);
