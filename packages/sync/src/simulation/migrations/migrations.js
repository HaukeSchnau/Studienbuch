// This file is required for Expo/React Native SQLite migrations - https://orm.drizzle.team/quick-sqlite/expo

import m0000 from "./20261029082019_device/migration.sql";
import m0001 from "./20261029143404_sealed/migration.sql";
import m0002 from "./20261111164531_profile/migration.sql";

export default {
  migrations: {
    "20261029082019_device": m0000,
    "20261029143404_sealed": m0001,
    "20261111164531_profile": m0002,
  },
};
