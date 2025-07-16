"use client";

import { colors } from "@stu/tailwind-config/web";
import { ThreeDot } from "react-loading-indicators";

export const LoadingIndicator = () => {
  return <ThreeDot variant="pulsate" color={colors.primary.DEFAULT} size="medium" />;
};
