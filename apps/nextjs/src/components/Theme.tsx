"use client";

import { useEffect } from "react";
import { z } from "zod";

import { useSafeParams } from "~/infrastructure/hooks/useSafeParams";
import { api } from "~/infrastructure/trpc/react";

export const Theme = () => {
  const { school } = useSafeParams(z.object({ school: z.coerce.number() }));
  const query = api.schools.getTheme.useQuery(school ?? -1, {
    enabled: school !== undefined,
  });

  useEffect(() => {
    if (!query.data) return;

    const theme = query.data.theme;
    const root = document.documentElement;

    root.style.setProperty("--primary", theme.primary.default.color);
    root.style.setProperty("--primary-pale", theme.primary.pale.color);
    root.style.setProperty("--primary-des", theme.primary.des.color);
    root.style.setProperty("--primary-text", theme.primary.text);

    root.style.setProperty("--accent", theme.accent.default.color);
    root.style.setProperty("--accent-sec", theme.accent.sec.color);
    root.style.setProperty("--accent-pale", theme.accent.pale.color);
    root.style.setProperty("--accent-des", theme.accent.des.color);

    root.style.setProperty("--danger", theme.danger.default.color);
    root.style.setProperty("--danger-sec", theme.danger.sec.color);
    root.style.setProperty("--danger-des", theme.danger.des.color);

    root.style.setProperty("--alert", theme.alert.default.color);
    root.style.setProperty("--alert-des", theme.alert.des.color);

    root.style.setProperty("--success", theme.success.default.color);
    root.style.setProperty("--success-des", theme.success.des.color);
    root.style.setProperty("--success-pale", theme.success.pale.color);

    root.style.setProperty("--neutral", theme.neutral.default.color);
    root.style.setProperty("--neutral-sec", theme.neutral.sec.color);

    root.style.setProperty("--surface", theme.surface.default.color);
    root.style.setProperty("--background", theme.background.default.color);

    root.style.setProperty("--on-primary", theme.primary.default.on);
    root.style.setProperty("--on-primary-pale", theme.primary.pale.on);
    root.style.setProperty("--on-primary-des", theme.primary.des.on);

    root.style.setProperty("--on-accent", theme.accent.default.on);
    root.style.setProperty("--on-accent-sec", theme.accent.sec.on);
    root.style.setProperty("--on-accent-pale", theme.accent.pale.on);
    root.style.setProperty("--on-accent-des", theme.accent.des.on);

    root.style.setProperty("--on-danger", theme.danger.default.on);
    root.style.setProperty("--on-danger-sec", theme.danger.sec.on);
    root.style.setProperty("--on-danger-des", theme.danger.des.on);

    root.style.setProperty("--on-alert", theme.alert.default.on);
    root.style.setProperty("--on-alert-des", theme.alert.des.on);

    root.style.setProperty("--on-success", theme.success.default.on);
    root.style.setProperty("--on-success-des", theme.success.des.on);
    root.style.setProperty("--on-success-pale", theme.success.pale.on);

    root.style.setProperty("--on-neutral", theme.neutral.default.on);
    root.style.setProperty("--on-neutral-sec", theme.neutral.sec.on);

    root.style.setProperty("--on-surface", theme.surface.default.on);
    root.style.setProperty("--on-background", theme.background.default.on);
  }, [query.data]);

  return null;
};
