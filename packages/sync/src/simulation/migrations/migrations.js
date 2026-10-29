// This file is required for Expo/React Native SQLite migrations - https://orm.drizzle.team/quick-sqlite/expo

import m0000 from "./20261029082019_device/migration.sql";
import m0001 from "./20261029132756_sealed/migration.sql";

export default {
  migrations: {
    "20261029082019_device": m0000,
    "20261029132756_sealed": m0001,
  },
};
