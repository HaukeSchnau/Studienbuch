import { CourseScreen, OverviewScreen, PhoneFrame } from "#/domain-ui/app-preview/phone.tsx";
import { AppIcon } from "#/domain-ui/brand/wordmark.tsx";
import { StoreBadges } from "#/domain-ui/brand/store-badges.tsx";
import { sectionIds } from "#/domain-ui/brand/links.ts";
import { SiteFooter } from "#/domain-ui/site-footer.tsx";
import { SiteNav } from "#/domain-ui/site-nav.tsx";
import { copy } from "#/features/marketing/copy.ts";
import {
  LabelSticker,
  RuledPaper,
  SwooshPanel,
} from "#/features/marketing/variants/swoosh/decor.tsx";

/**
 * Variant B, the app's own shape.
 *
 * The blobs are gone. In their place is the one shape the product already owns: the green band with
 * the blue line trailing out of it that caps every screen of the native app. It opens the page, the
 * hero device rides across its curve the way cards do natively, and it comes back once more for the
 * offline section. The notebook in the logo supplies the rest of the texture, as faint ruling behind
 * the features and as the white label the headings sit on.
 */
export const SwooshLanding = () => (
  <div className="min-h-screen overflow-x-clip">
    <SwooshPanel className="pt-4 pb-16 sm:pb-24 lg:pb-32">
      <SiteNav tone="surface" />

      <section className="mx-auto grid w-full max-w-6xl items-center gap-y-10 px-6 pt-14 md:px-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-x-10">
        <div>
          <div className="flex items-center gap-5 sm:gap-8">
            <AppIcon className="w-24 shadow-card-lg sm:w-28 lg:w-32" />
            <h1 className="text-4xl/[1.2] text-white sm:text-5xl/[1.2] lg:text-6xl/[1.15]">
              {copy.hero.headline[0]}
              <br />
              {copy.hero.headline[1]}
            </h1>
          </div>

          <p className="mt-8 max-w-lg text-lg/relaxed text-white/90 text-pretty sm:text-xl/relaxed">
            {copy.hero.lead}
          </p>

          <p className="mt-10 text-xl text-white sm:text-2xl">{copy.hero.downloadPrompt}</p>
          <StoreBadges className="mt-5" />
        </div>

        {/* Pulled down so the device crosses the curve instead of stopping above it. */}
        <div className="flex justify-center lg:-mb-40 lg:translate-x-[10%]">
          <PhoneFrame className="[zoom:0.62] sm:[zoom:0.8] lg:[zoom:0.95]">
            <OverviewScreen />
          </PhoneFrame>
        </div>
      </section>
    </SwooshPanel>

    <main>
      <section
        className="relative mx-auto w-full max-w-6xl px-6 pt-24 pb-20 md:px-10 lg:pt-40"
        id={sectionIds.features}
      >
        <RuledPaper />

        <LabelSticker>
          <h2 className="text-3xl/tight text-primary-text sm:text-4xl/tight">
            {copy.features.title}
          </h2>
        </LabelSticker>

        <p className="mt-6 max-w-2xl text-lg/relaxed text-ink-soft text-pretty">
          {copy.features.lead}
        </p>

        <div className="mt-14 grid gap-12 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
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

      <SwooshPanel className="pt-20 pb-24 sm:pb-32 lg:pb-40" id={sectionIds.offline}>
        <div className="mx-auto w-full max-w-3xl px-6 text-center md:px-10">
          <h2 className="text-3xl/tight text-white sm:text-4xl/tight">{copy.offline.title}</h2>
          <p className="mt-5 text-lg/relaxed text-white/90 text-pretty sm:text-xl/relaxed">
            {copy.offline.body}
          </p>
        </div>
      </SwooshPanel>

      <section className="mx-auto w-full max-w-4xl px-6 py-20 md:px-10" id={sectionIds.schools}>
        <LabelSticker className="bg-primary-des">
          <h2 className="text-2xl text-primary-text sm:text-3xl">{copy.schools.title}</h2>
        </LabelSticker>
        <p className="mt-6 max-w-2xl text-lg/relaxed text-ink-soft text-pretty">
          {copy.schools.body}
        </p>
        <a
          className="mt-6 inline-flex rounded-full bg-primary px-6 py-3 font-bold text-white shadow-card transition-transform hover:scale-105"
          href={copy.schools.href}
        >
          {copy.schools.cta}
        </a>
      </section>
    </main>

    <SiteFooter />
  </div>
);
