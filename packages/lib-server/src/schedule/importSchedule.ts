import fs from "node:fs";
import os from "node:os";
import p from "node:path";
import { isArraySingleElement } from "@stu/lib";
import { ensureParentDir, getFileHash, writeFile } from "../infrastructure";
import { convertPdf } from "../pdf";
import { parseScheduleCsv } from "./parseScheduleCsv";

const cacheDir = p.join(os.tmpdir(), "studienbuch", "imported-schedules");

export type ImportedScheduleCourses = Awaited<ReturnType<typeof parseScheduleCsv>>;

export type ScheduleImportResult =
  | {
      ok: true;
      courses: ImportedScheduleCourses;
    }
  | {
      ok: false;
      status: 400 | 500;
      message: string;
    };

export const importScheduleFromFile = async (file: File): Promise<ScheduleImportResult> => {
  const fileId = await getFileHash(file);
  const csvPath = p.join(cacheDir, fileId, "schedule.csv");
  const csvDir = p.dirname(csvPath);

  if (!(await hasConvertedCsv(csvDir))) {
    const pdfPath = p.join(cacheDir, `${fileId}.pdf`);

    await ensureParentDir(pdfPath);
    await writeFile(file, pdfPath);

    await ensureParentDir(csvPath);
    const conversionResult = await convertPdf(pdfPath, csvPath);

    if (!conversionResult.success) {
      await fs.promises.rm(csvDir, { force: true, recursive: true });
      return {
        ok: false,
        status: 500,
        message: "Error running camelot",
      };
    }
  }

  const csvFiles = await fs.promises.readdir(csvDir);
  if (!isArraySingleElement(csvFiles)) {
    return {
      ok: false,
      status: 400,
      message: "Nicht genau eine CSV-Datei gefunden",
    };
  }

  const csvFileName = csvFiles[0];
  const csvFilePath = p.join(csvDir, csvFileName);
  const courses = await parseScheduleCsv(csvFilePath, true);

  return {
    ok: true,
    courses,
  };
};

export const importScheduleFromFormData = async (formData: FormData): Promise<ScheduleImportResult> => {
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return {
      ok: false,
      status: 400,
      message: "No file provided",
    };
  }

  return importScheduleFromFile(file);
};

const hasConvertedCsv = async (csvDir: string): Promise<boolean> => {
  try {
    const files = await fs.promises.readdir(csvDir);
    return files.length > 0;
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return false;
    }

    throw error;
  }
};

const isNodeError = (error: unknown): error is NodeJS.ErrnoException => {
  return typeof error === "object" && error !== null && "code" in error;
};
