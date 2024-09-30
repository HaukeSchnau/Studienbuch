import crypto from "crypto";
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";

// let container: StartedPostgreSqlContainer;

export const getOrCreatePostgresContainer = async (id: string) => {
  // if (!container) {
  //   container = await new PostgreSqlContainer()
  //     .withTmpFs({
  //       "/var/lib/postgresql/data": "rw",
  //     })
  //     .withReuse()
  //     .start();
  // }

  // const idHash = crypto
  //   .createHash("md5")
  //   .update(id)
  //   .update(new Date().toISOString())
  //   .digest("hex");
  // await container.exec([
  //   "psql",
  //   "-U",
  //   container.getUsername(),
  //   "-c",
  //   `CREATE DATABASE test_${idHash};`,
  // ]);

  // return {
  //   container,
  //   database: `test_${idHash}`,
  // };
};

// export const teardownPostgresContainer = async () => {
//   if (container) {
//     await container.stop({remove});
//   }
// };
