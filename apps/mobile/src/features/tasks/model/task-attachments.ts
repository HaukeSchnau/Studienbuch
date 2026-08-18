import type { TaskAttachment } from "@/compat/mobile-v0";

const attachmentPalette = ["#B9D7F5", "#F5D9B9", "#D7E9C6", "#E2CEF5"] as const;

export const createTaskAttachment = ({
  index,
  label,
  uri,
}: {
  index: number;
  label?: string | null;
  uri?: string;
}): TaskAttachment => ({
  id: `attachment-${Date.now()}-${index}`,
  label: label?.trim() || `Foto ${index + 1}`,
  color: attachmentPalette[index % attachmentPalette.length] ?? attachmentPalette[0],
  uri,
});
