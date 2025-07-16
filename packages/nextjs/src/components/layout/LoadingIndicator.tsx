"use client";

import { ThreeDot } from "react-loading-indicators";

import { colors } from "@stu/tailwind-config/web";

export const LoadingIndicator = () => {
  return <ThreeDot variant="pulsate" color={colors.primary.DEFAULT} size="medium" />;
};
