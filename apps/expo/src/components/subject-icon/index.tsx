/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Image } from "expo-image";

import type { SubjectId } from "@stu/lib";

const subjectIconMap: Record<SubjectId, number> = {
  de: require("./icons/de.svg"),
  en: require("./icons/en.svg"),
  ma: require("./icons/ma.svg"),
  ph: require("./icons/ph.svg"),
  ch: require("./icons/ch.svg"),
  bi: require("./icons/bi.svg"),
  if: require("./icons/if.svg"),
  ge: require("./icons/ge.svg"),
  pw: require("./icons/pw.svg"),
  mu: require("./icons/mu.svg"),
  sp: require("./icons/sp.svg"),
  ku: require("./icons/ku.svg"),
  re: require("./icons/re.svg"),
  wn: require("./icons/wn.svg"),
  fr: require("./icons/fr.svg"),
  la: require("./icons/la.svg"),
  sn: require("./icons/sn.svg"),
  "sport-theorie": require("./icons/sp.svg"),
  sf: require("./icons/sf.svg"),
  tutorium: require("./icons/ds.svg"),
  ds: require("./icons/ds.svg"),
} as const;

export const SubjectIcon = ({ subject }: { subject: SubjectId }) => (
  <Image source={subjectIconMap[subject]} style={{ width: 24, height: 24 }} />
);
