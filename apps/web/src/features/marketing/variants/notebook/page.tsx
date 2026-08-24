import { CourseScreen, OverviewScreen, PhoneFrame } from "#/domain-ui/app-preview/phone.tsx";
import { StoreBadges } from "#/domain-ui/brand/store-badges.tsx";
import { sectionIds } from "#/domain-ui/brand/links.ts";
import { SiteFooter } from "#/domain-ui/site-footer.tsx";
import { SiteNav } from "#/domain-ui/site-nav.tsx";
import { copy } from "#/features/marketing/copy.ts";
import {
  CoverLabel,
  PaperPage,
  SpiralRail,
} from "#/features/marketing/variants/notebook/decor.tsx";

/**
 * Variant C, the notebook taken literally.
 *
 * The page is the object in the logo. The dark cover is the background, the binding rings run down
 * the left edge for its whole height, and every section is a sheet of ruled paper fanned out on top
 * of two more. The headline sits on the cover's white label, which is the logo at page scale rather
 * than a decoration next to it.
 *
 * This is the most opinionated of the three and the one most likely to be too much. It is here to
 * find out whether it is.
 */
export const NotebookLanding = () => (
  <div className="relative min-h-screen overflow-x-clip bg-notebook">
    <div aria-hidden className="absolute inset-y-0 left-0 hidden sm:block">
      <SpiralRail />
    </div>

    <div className="pt-4 sm:pl-20">
      <SiteNav tone="surface" />

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-16 px-4 pt-14 pb-16 sm:px-8">
        {/* The cover. No card, no panel — the headline is on the label and the label is on the
            notebook itself. */}
        <section className="grid items-center gap-y-12 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-x-10">
          <div>
            <CoverLabel>
              <h1 className="text-4xl/[1.2] text-primary-text sm:text-5xl/[1.2] lg:text-6xl/[1.15]">
                {copy.hero.headline[0]}
                <br />
                {copy.hero.headline[1]}
              </h1>
            </CoverLabel>

            <p className="mt-10 max-w-lg text-lg/relaxed text-white/80 text-pretty sm:text-xl/relaxed">
              {copy.hero.lead}
            </p>

            <p className="mt-10 text-xl text-white sm:text-2xl">{copy.hero.downloadPrompt}</p>
            <StoreBadges className="mt-5" />
          </div>

          <div className="flex justify-center">
            <PhoneFrame className="[zoom:0.62] shadow-none ring-1 ring-white/10 sm:[zoom:0.8] lg:[zoom:0.95]">
              <OverviewScreen />
            </PhoneFrame>
          </div>
        </section>

        <PaperPage id={sectionIds.features}>
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
        </PaperPage>

        <PaperPage id={sectionIds.offline}>
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl/tight text-primary-text sm:text-4xl/tight">
              {copy.offline.title}
            </h2>
            <p className="mt-5 text-lg/relaxed text-ink-soft text-pretty sm:text-xl/relaxed">
              {copy.offline.body}
            </p>
          </div>
        </PaperPage>

        <PaperPage id={sectionIds.schools}>
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
        </PaperPage>
      </main>

      <SiteFooter tone="light" />
    </div>
  </div>
);
