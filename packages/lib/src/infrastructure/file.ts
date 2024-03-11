import crypto from "crypto";
import fs from "fs";
import p from "path";

export const fileExists = async (path: string) => {
  try {
    await fs.promises.access(path);
    return true;
  } catch {
    return false;
  }
};

export const ensureParentDir = async (path: string) => {
  const parentDir = p.dirname(path);
  await fs.promises.mkdir(parentDir, { recursive: true });
};

export const getFileHash = async (file: File) => {
  const fileHash = crypto.createHash("sha256");
  const hashWriteStream = new WritableStream<Uint8Array>({
    write(chunk) {
      fileHash.write(chunk);
    },
  });
  await file.stream().pipeTo(hashWriteStream);
  return fileHash.digest("hex");
};

export const writeFile = async (file: File, path: string) => {
  const writeStream = fs.createWriteStream(path);
  const writableStream = new WritableStream<Uint8Array>({
    write(chunk) {
      writeStream.write(chunk);
    },
  });
  await file.stream().pipeTo(writableStream);
  writeStream.close();
};
