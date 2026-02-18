import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import type { GlobalSetupContext } from "vitest/node";
import { createClient } from "./client";
import { insertFixtures } from "./insert-fixtures";

const migrationsFolder = fileURLToPath(new URL("../drizzle", import.meta.url));
const execFileAsync = promisify(execFile);

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const findFreePort = async (): Promise<number> => {
  const net = await import("node:net");
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Unable to allocate free port"));
        return;
      }
      const { port } = address;
      server.close((error) => {
        if (error) {
          reject(error);
        } else {
          resolve(port);
        }
      });
    });
    server.on("error", reject);
  });
};

export default async function setup({ provide }: GlobalSetupContext) {
  const port = await findFreePort();
  const containerName = `studienbuch-live-pg-${Date.now().toString(36)}`;

  await execFileAsync("docker", [
    "run",
    "-d",
    "--rm",
    "--name",
    containerName,
    "-e",
    "POSTGRES_PASSWORD=stu",
    "-e",
    "POSTGRES_USER=stu",
    "-e",
    "POSTGRES_DB=stu_live",
    "-p",
    `${port}:5432`,
    "postgres:17-alpine",
  ]);

  const connectionUri = `postgresql://stu:stu@127.0.0.1:${port}/stu_live`;

  try {
    for (let attempt = 0; attempt < 60; attempt++) {
      try {
        const { client } = await createClient(connectionUri);
        await client.end();
        break;
      } catch {
        if (attempt === 59) {
          throw new Error("Timed out waiting for postgres container to become ready");
        }
        await wait(1_000);
      }
    }

    const { db, client } = await createClient(connectionUri);
    await migrate(db, { migrationsFolder });
    await insertFixtures(db);
    await client.end();
  } catch (error) {
    await execFileAsync("docker", ["stop", containerName]);
    throw error;
  }

  provide("database", {
    connectionUri,
    host: "127.0.0.1",
    port,
    username: "stu",
    password: "stu",
    database: "stu_live",
  });

  return async () => {
    await execFileAsync("docker", ["stop", containerName]);
  };
}

declare module "vitest" {
  export interface ProvidedContext {
    database: {
      connectionUri: string;
      host: string;
      port: number;
      username: string;
      password: string;
      database: string;
    };
  }
}
