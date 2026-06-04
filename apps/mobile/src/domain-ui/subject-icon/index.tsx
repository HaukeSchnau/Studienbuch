import type { SubjectId } from "@stu/core";
import type { ComponentType } from "react";
import { View } from "react-native";
import type { SvgProps } from "react-native-svg";

import bi from "./icons/bi.svg";
import ch from "./icons/ch.svg";
import de from "./icons/de.svg";
import tutorium from "./icons/ds.svg";
import ds from "./icons/ds.svg";
import en from "./icons/en.svg";
import fr from "./icons/fr.svg";
import ge from "./icons/ge.svg";
import ifIcon from "./icons/if.svg";
import ku from "./icons/ku.svg";
import la from "./icons/la.svg";
import ma from "./icons/ma.svg";
import mu from "./icons/mu.svg";
import ph from "./icons/ph.svg";
import pw from "./icons/pw.svg";
import re from "./icons/re.svg";
import sf from "./icons/sf.svg";
import sn from "./icons/sn.svg";
import sp from "./icons/sp.svg";
import sportTheorie from "./icons/sp.svg";
import wn from "./icons/wn.svg";

// TODO: Remove partial when all subjects have icons
const subjectIconMap: Partial<Record<SubjectId, ComponentType<SvgProps>>> = {
  de,
  en,
  ma,
  ph,
  ch,
  bi,
  if: ifIcon,
  ge,
  pw,
  mu,
  sp,
  ku,
  re,
  wn,
  fr,
  la,
  sn,
  "sport-theorie": sportTheorie,
  sf,
  tutorium,
  ds,
} as const;

export const SubjectIcon = ({ subject, size = 24 }: { subject: SubjectId; size?: number }) => {
  const Icon = subjectIconMap[subject];
  return Icon ? (
    <Icon width={size} height={size} />
  ) : (
    <View
      style={{
        width: size,
        height: size,
      }}
    />
  );
};
