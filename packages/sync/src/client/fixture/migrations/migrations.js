// This file is required for Expo/React Native SQLite migrations - https://orm.drizzle.team/quick-sqlite/expo

import m0000 from "./20261029054754_device/migration.sql";
import m0001 from "./20261029055817_settled/migration.sql";
import m0002 from "./20261029064743_replay_due/migration.sql";
import m0003 from "./20261029082106_comment/migration.sql";
import m0004 from "./20261029132024_sealed/migration.sql";

export default {
  migrations: {
    "20261029054754_device": m0000,
    "20261029055817_settled": m0001,
    "20261029064743_replay_due": m0002,
    "20261029082106_comment": m0003,
    "20261029132024_sealed": m0004,
  },
};
