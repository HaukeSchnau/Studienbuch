import { Container, Section } from "#/ui/section.tsx";

import { AbsencePreview } from "./app-previews.tsx";

/**
 * Why this product exists, shown rather than asserted.
 *
 * The paper booklet is drawn in markup rather than photographed: a stock photo of someone else's
 * notebook would be a lie, and a real one would need shooting and reshooting. Ruled lines, a
 * coffee ring, a crossed-out entry and a biro signature are enough — everyone who has held one
 * recognises it immediately.
 */
const PaperPage = () => (
  <div
    aria-hidden
    className="relative w-full max-w-xs -rotate-2 overflow-hidden rounded-sm bg-[#fdfcf7] p-5 shadow-card-lg ring-1 ring-black/5"
  >
    {/* Ruled lines and the red margin rule of a school exercise book. */}
    <div
      className="absolute inset-0"
      style={{
        backgroundImage:
          "repeating-linear-gradient(to bottom, transparent 0 27px, rgba(32,55,85,0.13) 27px 28px)",
      }}
    />
    <div className="absolute inset-y-0 left-9 w-px bg-danger/25" />

    {/* Coffee. */}
    <div className="absolute -top-4 -right-6 size-24 rounded-full border-[6px] border-[#b98a4b]/25" />

    <div className="relative pl-6">
      <p className="text-sm font-bold text-ink/70">Fehlzeiten</p>
      <p className="mt-6 text-sm text-ink/60">12.05. — 1 Std.</p>
      <p className="mt-2 text-sm text-ink/60 line-through decoration-danger/60 decoration-2">
        14.05. — 2 Std.
      </p>
      <p className="mt-8 font-[cursive] text-lg text-accent-sec/70 italic">Unterschrift</p>
      <div className="mt-1 h-px w-32 bg-ink/25" />
    </div>
  </div>
);

export const PaperContrast = () => (
  <Section tone="background">
    <Container className="flex flex-col gap-12">
      {/* Both sides show the same record — a day of absences — so this is a comparison rather than
          two unrelated screenshots. Labels sit above so they line up across columns of different
          heights. */}
      <div className="grid items-start gap-10 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
        <div className="reveal flex flex-col items-center gap-5">
          <p className="text-sm font-bold tracking-[0.14em] text-neutral uppercase">Vorher</p>
          <PaperPage />
        </div>

        <p aria-hidden className="hidden self-center text-4xl text-primary-pale sm:block">
          →
        </p>

        <div className="reveal flex flex-col items-center gap-5">
          <p className="text-sm font-bold tracking-[0.14em] text-primary-text uppercase">Nachher</p>
          <div className="w-full max-w-xs">
            <AbsencePreview />
          </div>
        </div>
      </div>

      <p className="mx-auto max-w-2xl text-center text-xl/relaxed text-ink-soft text-pretty">
        Ein Studienbuch aus Papier geht verloren, wird nass und ist am Ende des Halbjahres kaum noch
        zu entziffern. Dieselben Einträge, nur nachvollziehbar — und immer dabei.
      </p>
    </Container>
  </Section>
);
