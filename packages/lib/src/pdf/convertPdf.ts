import { exec as execCb } from "child_process";
import p from "path";
import util from "util";

const exec = util.promisify(execCb);

const pythonVenv = p.resolve(process.cwd(), "..", "..", ".venv");
const camelotPath = p.resolve(pythonVenv, "bin", "camelot");

export const convertPdf = async (pdfPath: string, csvPath: string) => {
  const command = `${camelotPath} --format csv --pages all -o ${csvPath} lattice ${pdfPath}`;
  try {
    await exec(command);
    return {
      success: true,
    };
  } catch (error) {
    return {
      success: false,
      error,
    };
  }
};
