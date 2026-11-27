import { SubjectSticker } from "@stu/domain-ui/subject/SubjectSticker";
import { Tokens } from "@stu/ui/Tokens";

import { DriftingRow } from "#/ui/DriftingRow.tsx";

import { Demo } from "./Demo.ts";

/**
 * A timetable drifting past, in the app's subject stickers on the course colours. It says "school"
 * faster than any sentence. The row is decoration, so it is hidden from assistive technology;
 * reaching for a tile stops it.
 */
export function SubjectStrip() {
  return (
    <div className="subject-strip">
      <DriftingRow>
        {Demo.strip.map(({ art, label, slot }, index) => (
          <span
            className="subject-tile"
            key={label}
            // Each tile is further through the same bob, so the row undulates instead of pumping.
            style={{
              animationDelay: `${String(index * -0.28)}s`,
              backgroundColor: Tokens.subject[slot].fill,
            }}
          >
            <SubjectSticker art={art} size={36} />
            {label}
          </span>
        ))}
      </DriftingRow>
    </div>
  );
}
