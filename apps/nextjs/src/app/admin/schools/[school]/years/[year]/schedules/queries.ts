import { useMutation } from "@tanstack/react-query";

import type { PostReturn } from "~/app/api/schedule/import/route";

export const useScheduleImportMutation = () => {
  return useMutation({
    mutationKey: ["custom/scheduleImport"],
    mutationFn: async (data: { file: File }) => {
      const formData = new FormData();
      formData.append("file", data.file);
      const response = await fetch("/api/schedule/import", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        throw new Error(`Failed to import schedule: ${response.statusText}`);
      }

      return response.json() as Promise<PostReturn>;
    },
  });
};
