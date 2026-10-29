// This file is required for Expo/React Native SQLite migrations - https://orm.drizzle.team/quick-sqlite/expo

import m0000 from "./20261029054754_device/migration.sql";
import m0001 from "./20261029055817_settled/migration.sql";

export default {
  migrations: {
    "20261029054754_device": m0000,
    "20261029055817_settled": m0001,
  },
};
