// This file is required for Expo/React Native SQLite migrations - https://orm.drizzle.team/quick-sqlite/expo

import m0000 from "./20261029074425_device/migration.sql";
import m0001 from "./20261029143412_sealed/migration.sql";
import m0002 from "./20261107111859_profile_adult/migration.sql";

export default {
  migrations: {
    "20261029074425_device": m0000,
    "20261029143412_sealed": m0001,
    "20261107111859_profile_adult": m0002,
  },
};
