import fs from "fs";
import os from "os";
import p from "path";

import type { ProtoCourseWithTimes } from "@schnau/lib";
import { isArraySingleElement } from "@schnau/lib";
import {
  convertPdf,
  ensureParentDir,
  getFileHash,
  parseScheduleCsv,
  writeFile,
} from "@schnau/lib-server";

const cacheDir = p.join(os.tmpdir(), "studienbuch", "imported-schedules");

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return new Response(JSON.stringify({ message: "No file provided" }), {
      status: 400,
    });
  }

  const fileId = await getFileHash(file);

  const csvPath = p.join(cacheDir, fileId, "schedule.csv");

  if (
    !fs.existsSync(p.dirname(csvPath)) ||
    (await fs.promises.readdir(p.dirname(csvPath))).length === 0
  ) {
    const pdfPath = p.join(cacheDir, fileId + ".pdf");

    await ensureParentDir(pdfPath);
    await writeFile(file, pdfPath);

    await ensureParentDir(csvPath);
    const conversionResult = await convertPdf(pdfPath, csvPath);

    if (!conversionResult.success) {
      await fs.promises.unlink(p.basename(csvPath));
      return new Response(
        JSON.stringify({
          message: "Error running camelot",
        }),
        {
          status: 500,
        },
      );
    }
  }

  const csvFiles = await fs.promises.readdir(p.dirname(csvPath));
  if (!isArraySingleElement(csvFiles)) {
    return new Response(
      JSON.stringify({ message: "Nicht genau eine CSV-Datei gefunden" }),
      {
        status: 400,
      },
    );
  }

  const csvFileName = csvFiles[0];
  const csvFilePath = p.join(p.dirname(csvPath), csvFileName);

  const courses = await parseScheduleCsv(csvFilePath, true);

  const ret: PostReturn = courses;
  return new Response(JSON.stringify(ret), { status: 200 });
}

export type PostReturn = ProtoCourseWithTimes[];
